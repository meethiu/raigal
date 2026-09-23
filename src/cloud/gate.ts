import { getActiveToken } from "./credentials.js";
import {
	getEntitlement,
	LicenceDeniedError,
	LicenceUnverifiableError,
	MissingCredentialError,
	type ResolvedEntitlement,
} from "./entitlement.js";
import { checkOwnerAgainstAllowlist, detectLocalRepoOwner } from "./owner.js";

type GateMode = "fatal" | "quiet" | "throw";

export interface RequireEntitlementOptions {
	directory?: string;
	mode?: GateMode;
	repoOwner?: string;
}

export interface EntitlementGateResult {
	ok: boolean;
	entitlement?: ResolvedEntitlement;
	exitCode?: number;
	message?: string;
}

export const requireEntitlement = async (
	options: RequireEntitlementOptions = {},
): Promise<EntitlementGateResult> => {
	const directory = options.directory ?? process.cwd();
	const mode = options.mode ?? "fatal";

	try {
		const entitlement = await getEntitlement();
		const activeToken = getActiveToken();
		const tokenKind = activeToken?.kind ?? "session";

		const detectedOwner = detectLocalRepoOwner(directory);
		if (options.repoOwner) {
			detectedOwner.owner = options.repoOwner.toLowerCase();
		}

		const ownerCheck = checkOwnerAgainstAllowlist(
			detectedOwner,
			entitlement.claims.allowed_owners,
			tokenKind,
		);

		if (!ownerCheck.allowed) {
			const message = `Raigal is proprietary software: ${ownerCheck.reason ?? "repository owner is not on the organization allowlist."}`;
			if (mode === "throw") throw new LicenceDeniedError(message, "owner_not_allowed");
			if (mode === "fatal") {
				process.stderr.write(`${message}\n`);
				process.exit(30);
			}
			process.stderr.write(`[raigal] ${message}\n`);
			return { ok: false, exitCode: 30, message };
		}

		return { ok: true, entitlement };
	} catch (err: unknown) {
		let exitCode = 30;
		let message = "";

		if (err instanceof MissingCredentialError) {
			exitCode = 30;
			message =
				'Raigal is proprietary software available to approved organizations. Run "raigal login" or set RAIGAL_TOKEN.';
		} else if (err instanceof LicenceDeniedError) {
			exitCode = 30;
			message = `Raigal license denied: ${err.message}`;
		} else if (err instanceof LicenceUnverifiableError) {
			exitCode = 31;
			message = `Raigal license unverifiable: ${err.message}`;
		} else {
			exitCode = 30;
			message = `Raigal license validation failed: ${err instanceof Error ? err.message : String(err)}`;
		}

		if (mode === "throw") {
			throw err;
		}

		if (mode === "fatal") {
			process.stderr.write(`${message}\n`);
			process.exit(exitCode);
		}

		// Quiet mode (hooks, editor integrations, framework adapters, MCP tools)
		process.stderr.write(`[raigal] ${message}\n`);
		return { ok: false, exitCode, message };
	}
};
