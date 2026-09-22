import fs from "node:fs";
import path from "node:path";
import { ApiError, fetchEntitlementFromApi } from "./client.js";
import { getActiveToken } from "./credentials.js";
import { JwtVerificationError, verifyEntitlementJwt } from "./jwt.js";
import { fetchGitHubOidcToken } from "./oidc.js";
import { getEntitlementPath } from "./paths.js";
import type { EntitlementClaimsType } from "./types.js";

const GRACE_PERIOD_SECONDS = 72 * 60 * 60; // 72 hours

export class MissingCredentialError extends Error {
	constructor(message = "No organization credential found") {
		super(message);
		this.name = "MissingCredentialError";
	}
}

export class LicenceDeniedError extends Error {
	constructor(
		message: string,
		public readonly code: string = "licence_denied",
	) {
		super(message);
		this.name = "LicenceDeniedError";
	}
}

export class LicenceUnverifiableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LicenceUnverifiableError";
	}
}

export interface CachedEntitlementPayload {
	entitlement: string;
	refresh_after: number;
}

export interface ResolvedEntitlement {
	jwt: string;
	claims: EntitlementClaimsType;
	fromCache: boolean;
	grace?: boolean;
}

export const loadCachedEntitlement = (): CachedEntitlementPayload | null => {
	const p = getEntitlementPath();
	if (!fs.existsSync(p)) return null;

	try {
		const raw = fs.readFileSync(p, "utf-8");
		const data = JSON.parse(raw) as Partial<CachedEntitlementPayload>;
		if (typeof data.entitlement === "string" && typeof data.refresh_after === "number") {
			return {
				entitlement: data.entitlement,
				refresh_after: data.refresh_after,
			};
		}
		return null;
	} catch {
		return null;
	}
};

export const saveCachedEntitlement = (entitlement: string, refreshAfter: number): void => {
	const p = getEntitlementPath();
	const dir = path.dirname(p);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const payload: CachedEntitlementPayload = {
		entitlement,
		refresh_after: refreshAfter,
	};

	const temp = `${p}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
	try {
		fs.renameSync(temp, p);
	} catch {
		fs.rmSync(temp, { force: true });
		fs.writeFileSync(p, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
	}

	if (process.platform !== "win32") {
		try {
			fs.chmodSync(p, 0o600);
		} catch {
			/* best effort */
		}
	}
};

export const clearCachedEntitlement = (): void => {
	const p = getEntitlementPath();
	if (fs.existsSync(p)) {
		try {
			fs.rmSync(p, { force: true });
		} catch {
			/* best effort */
		}
	}
};

const handleEntitlementFetchError = (
	err: unknown,
	cached: CachedEntitlementPayload | null,
	cachedClaims: EntitlementClaimsType | null,
	now: number,
): ResolvedEntitlement => {
	// Handle explicit denial from server (401, 402, 403, 426)
	if (err instanceof ApiError && [401, 402, 403, 426].includes(err.status)) {
		clearCachedEntitlement();
		throw new LicenceDeniedError(err.message, err.code || `http_${err.status}`);
	}

	// If it's a network error or 5xx, try to fall back to cached lease within 72h grace
	if (cached) {
		try {
			const graceClaims = verifyEntitlementJwt(cached.entitlement, {
				nowSeconds: now,
				allowGraceSeconds: GRACE_PERIOD_SECONDS,
			});

			return {
				jwt: cached.entitlement,
				claims: graceClaims,
				fromCache: true,
				grace: now > graceClaims.exp,
			};
		} catch (jwtErr) {
			if (jwtErr instanceof JwtVerificationError && jwtErr.code === "expired_beyond_grace") {
				const expIso = new Date((cachedClaims?.exp ?? 0) * 1000).toISOString();
				throw new LicenceUnverifiableError(
					`Raigal license could not be verified online and the offline grace period expired on ${expIso}. Check network connectivity or Raigal Cloud status.`,
				);
			}
		}
	}

	throw new LicenceUnverifiableError(
		`Raigal license could not be verified online (${err instanceof Error ? err.message : String(err)}). Check network connectivity or Raigal Cloud status.`,
	);
};

export const getEntitlement = async (): Promise<ResolvedEntitlement> => {
	const now = Math.floor(Date.now() / 1000);
	const activeToken = getActiveToken();
	const cached = loadCachedEntitlement();

	let cachedClaims: EntitlementClaimsType | null = null;
	if (cached) {
		try {
			cachedClaims = verifyEntitlementJwt(cached.entitlement, { nowSeconds: now });
		} catch {
			cachedClaims = null;
		}
	}

	// If cached token is valid and we haven't reached refresh_after, reuse immediately
	if (cached && cachedClaims && now < cached.refresh_after) {
		return {
			jwt: cached.entitlement,
			claims: cachedClaims,
			fromCache: true,
		};
	}

	// If no credential exists, check if GitHub Actions OIDC token is available
	let oidcToken: string | undefined;
	if (!activeToken) {
		oidcToken = await fetchGitHubOidcToken();
		if (!oidcToken) {
			if (cached && cachedClaims) {
				return {
					jwt: cached.entitlement,
					claims: cachedClaims,
					fromCache: true,
				};
			}
			throw new MissingCredentialError(
				'Raigal is proprietary software available to approved organizations. Run "raigal login", set RAIGAL_TOKEN, or enable id-token: write in GitHub Actions.',
			);
		}
	} else {
		oidcToken = await fetchGitHubOidcToken();
	}

	// Attempt online refresh
	try {
		const tokenToPass = activeToken?.token ?? "";
		const response = await fetchEntitlementFromApi(tokenToPass, oidcToken);
		const claims = verifyEntitlementJwt(response.entitlement, { nowSeconds: now });

		saveCachedEntitlement(response.entitlement, response.refresh_after);

		return {
			jwt: response.entitlement,
			claims,
			fromCache: false,
		};
	} catch (err: unknown) {
		return handleEntitlementFetchError(err, cached, cachedClaims, now);
	}
};
