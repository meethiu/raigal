import { verify } from "node:crypto";
import { APP_VERSION } from "../version.js";
import { EntitlementClaims } from "./contract.js";
import { getPublicKey } from "./keys.js";
import type { EntitlementClaimsType } from "./types.js";

export class JwtVerificationError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "invalid_format"
			| "unsupported_algorithm"
			| "unknown_kid"
			| "invalid_signature"
			| "invalid_claims"
			| "invalid_issuer"
			| "cli_version_unsupported"
			| "expired"
			| "expired_beyond_grace",
	) {
		super(message);
		this.name = "JwtVerificationError";
	}
}

interface JwtHeader {
	alg?: string;
	typ?: string;
	kid?: string;
}

const isVersionAtLeast = (current: string, required: string): boolean => {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split("-")[0]
			?.split(".")
			.map((n) => Number.parseInt(n, 10) || 0) ?? [0, 0, 0];

	const [cMajor = 0, cMinor = 0, cPatch = 0] = parse(current);
	const [rMajor = 0, rMinor = 0, rPatch = 0] = parse(required);

	if (cMajor !== rMajor) return cMajor > rMajor;
	if (cMinor !== rMinor) return cMinor > rMinor;
	return cPatch >= rPatch;
};

export interface VerifyJwtOptions {
	nowSeconds?: number;
	allowGraceSeconds?: number;
}

export const verifyEntitlementJwt = (
	jwt: string,
	options: VerifyJwtOptions = {},
): EntitlementClaimsType => {
	const parts = jwt.trim().split(".");
	if (parts.length !== 3 || !parts[0] || !parts[1]) {
		throw new JwtVerificationError("JWT must have 3 segments", "invalid_format");
	}

	const [headerB64, payloadB64, signatureB64] = parts;

	let header: JwtHeader;
	try {
		header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8")) as JwtHeader;
	} catch {
		throw new JwtVerificationError("Failed to parse JWT header", "invalid_format");
	}

	// Non-negotiable security requirement: accept only EdDSA
	if (header.alg !== "EdDSA") {
		throw new JwtVerificationError(
			`Unsupported JWT algorithm: ${header.alg ?? "none"}. Only EdDSA is accepted.`,
			"unsupported_algorithm",
		);
	}

	if (!signatureB64) {
		throw new JwtVerificationError("JWT missing signature", "invalid_format");
	}

	if (!header.kid) {
		throw new JwtVerificationError("JWT header missing 'kid'", "unknown_kid");
	}

	const publicKey = getPublicKey(header.kid);
	if (!publicKey) {
		throw new JwtVerificationError(
			`Unknown or untrusted signing key id (kid: ${header.kid})`,
			"unknown_kid",
		);
	}

	const signedData = Buffer.from(`${headerB64}.${payloadB64}`, "utf-8");
	const signature = Buffer.from(signatureB64, "base64url");

	const isValidSignature = verify(null, signedData, publicKey, signature);
	if (!isValidSignature) {
		throw new JwtVerificationError("Invalid JWT cryptographic signature", "invalid_signature");
	}

	let rawPayload: unknown;
	try {
		rawPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
	} catch {
		throw new JwtVerificationError("Failed to parse JWT payload JSON", "invalid_format");
	}

	const parsed = EntitlementClaims.safeParse(rawPayload);
	if (!parsed.success) {
		throw new JwtVerificationError(
			`Invalid entitlement claims: ${parsed.error.message}`,
			"invalid_claims",
		);
	}

	const claims = parsed.data;

	const expectedIssuer = process.env.RAIGAL_ISSUER?.trim() || "https://app.raigal.dev";
	if (claims.iss !== expectedIssuer) {
		throw new JwtVerificationError(`Untrusted issuer: ${claims.iss}`, "invalid_issuer");
	}

	if (!isVersionAtLeast(APP_VERSION, claims.min_cli_version)) {
		throw new JwtVerificationError(
			`CLI version ${APP_VERSION} is below required minimum ${claims.min_cli_version}. Run "raigal update" or "npm install -g @methiu/raigal@latest".`,
			"cli_version_unsupported",
		);
	}

	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	const grace = options.allowGraceSeconds ?? 0;

	if (now > claims.exp + grace) {
		const isBeyondGrace = grace > 0;
		throw new JwtVerificationError(
			isBeyondGrace
				? `Entitlement expired beyond offline grace period (${new Date(claims.exp * 1000).toISOString()})`
				: `Entitlement expired at ${new Date(claims.exp * 1000).toISOString()}`,
			isBeyondGrace ? "expired_beyond_grace" : "expired",
		);
	}

	return claims;
};
