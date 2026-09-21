import { requestApi } from "../cloud/client.js";
import { getActiveToken } from "../cloud/credentials.js";
import { getEntitlement } from "../cloud/entitlement.js";
import { log } from "../ui/logger.js";

interface WhoamiApiResponse {
	org: { id: string; name: string };
	user?: { id: string; email: string };
	plan: "trial" | "active";
	trial_started_at: string | null;
	trial_ends_at: string | null;
	allowed_owners: Array<{ id: number; login: string }>;
}

export const whoamiCommand = async (): Promise<void> => {
	const active = getActiveToken();
	if (!active) {
		log.info("Not signed in. Run `raigal login` or set RAIGAL_TOKEN.");
		return;
	}

	let whoamiData: WhoamiApiResponse | null = null;
	try {
		whoamiData = await requestApi<WhoamiApiResponse>("/v1/whoami", {
			token: active.token,
			timeoutMs: 4000,
		});
	} catch {
		// If offline, we will read claims from cached entitlement
	}

	let entitlementInfo = null;
	try {
		entitlementInfo = await getEntitlement();
	} catch {
		/* offline fallback */
	}

	const claims = entitlementInfo?.claims;
	const orgName = whoamiData?.org.name || claims?.org_name || active.org?.name || "Unknown Org";
	const orgId = whoamiData?.org.id || claims?.sub || active.org?.id || "Unknown ID";
	const userEmail = whoamiData?.user?.email || active.user?.email;
	const plan = whoamiData?.plan || claims?.plan || "active";
	const trialEnd = whoamiData?.trial_ends_at || claims?.trial_ends_at;
	const owners = (whoamiData?.allowed_owners || claims?.allowed_owners || [])
		.map((o) => o.login)
		.join(", ");

	process.stdout.write("\n");
	process.stdout.write(`  Organization:     ${orgName} (${orgId})\n`);
	if (userEmail) {
		process.stdout.write(`  User:             ${userEmail}\n`);
	}
	process.stdout.write(
		`  Credential:       ${active.kind === "api_key" ? "Org API Key" : "User Session"} (via ${active.source})\n`,
	);
	process.stdout.write(
		`  Plan:             ${plan}${trialEnd ? ` (trial ends ${trialEnd})` : ""}\n`,
	);
	process.stdout.write(`  Allowed Owners:   ${owners || "none"}\n`);

	if (claims) {
		const expDate = new Date(claims.exp * 1000).toISOString();
		process.stdout.write(
			`  Lease Expiry:     ${expDate}${entitlementInfo?.grace ? " (in grace period)" : ""}\n`,
		);
	}
	process.stdout.write("\n");
};
