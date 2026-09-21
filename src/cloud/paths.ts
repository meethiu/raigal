import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const getConfigDir = (): string => {
	if (process.env.RAIGAL_CONFIG_DIR) {
		return path.resolve(process.env.RAIGAL_CONFIG_DIR);
	}

	const home = process.env.HOME || os.homedir();

	if (process.platform === "win32") {
		const appData = process.env.APPDATA;
		return appData ? path.join(appData, "raigal") : path.join(home, ".raigal");
	}

	if (process.platform === "darwin") {
		const appSupport = path.join(home, "Library", "Application Support", "raigal");
		const dotRaigal = path.join(home, ".raigal");
		if (fs.existsSync(dotRaigal) && !fs.existsSync(appSupport)) {
			return dotRaigal;
		}
		return appSupport;
	}

	const xdgConfig = process.env.XDG_CONFIG_HOME;
	if (xdgConfig) {
		return path.join(xdgConfig, "raigal");
	}
	return path.join(home, ".config", "raigal");
};

export const getStateDir = (): string => {
	if (process.env.RAIGAL_STATE_DIR) {
		return path.resolve(process.env.RAIGAL_STATE_DIR);
	}

	if (process.env.RAIGAL_CONFIG_DIR) {
		return path.resolve(process.env.RAIGAL_CONFIG_DIR);
	}

	if (process.platform === "linux" && process.env.XDG_STATE_HOME) {
		return path.join(process.env.XDG_STATE_HOME, "raigal");
	}

	return getConfigDir();
};

export const getCredentialsPath = (): string => path.join(getConfigDir(), "credentials.json");

export const getEntitlementPath = (): string => path.join(getStateDir(), "entitlement.json");

export const getOutboxPath = (): string => path.join(getStateDir(), "outbox.jsonl");

export const getPolicyCachePath = (): string => path.join(getStateDir(), "policy-cache.json");
