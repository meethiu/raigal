import { revokeSessionApi } from "../cloud/client.js";
import { clearStoredCredentials, getActiveToken } from "../cloud/credentials.js";
import { clearCachedEntitlement } from "../cloud/entitlement.js";
import { log } from "../ui/logger.js";

export const logoutCommand = async (): Promise<void> => {
	const active = getActiveToken();
	if (active && active.kind === "session") {
		await revokeSessionApi(active.token);
	}

	clearStoredCredentials();
	clearCachedEntitlement();

	log.success("Signed out and cleared cached credentials.");
};
