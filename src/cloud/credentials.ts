import fs from "node:fs";
import path from "node:path";
import { getCredentialsPath } from "./paths.js";

export interface StoredCredentials {
	token: string;
	org?: {
		id: string;
		name: string;
	};
	user?: {
		id: string;
		email: string;
	};
	expires_at?: string;
	created_at: string;
}

export type TokenKind = "api_key" | "session";

export const detectTokenKind = (token: string): TokenKind => {
	if (token.startsWith("rgl_live_")) return "api_key";
	return "session";
};

export interface ActiveTokenInfo {
	token: string;
	source: "env" | "file";
	kind: TokenKind;
	org?: { id: string; name: string };
	user?: { id: string; email: string };
}

export const loadStoredCredentials = (): StoredCredentials | null => {
	const credPath = getCredentialsPath();
	if (!fs.existsSync(credPath)) return null;

	try {
		const raw = fs.readFileSync(credPath, "utf-8");
		const data = JSON.parse(raw) as Partial<StoredCredentials>;
		if (typeof data.token === "string" && data.token.length > 0) {
			return {
				token: data.token,
				org: data.org,
				user: data.user,
				expires_at: data.expires_at,
				created_at: data.created_at ?? new Date().toISOString(),
			};
		}
		return null;
	} catch {
		return null;
	}
};

export const saveStoredCredentials = (creds: Omit<StoredCredentials, "created_at">): void => {
	const credPath = getCredentialsPath();
	const dir = path.dirname(credPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const payload: StoredCredentials = {
		...creds,
		created_at: new Date().toISOString(),
	};

	const tempPath = `${credPath}.${process.pid}.tmp`;
	fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, {
		mode: 0o600,
	});

	try {
		fs.renameSync(tempPath, credPath);
	} catch {
		fs.rmSync(tempPath, { force: true });
		fs.writeFileSync(credPath, `${JSON.stringify(payload, null, 2)}\n`, {
			mode: 0o600,
		});
	}

	// Double-check permissions on non-Windows
	if (process.platform !== "win32") {
		try {
			fs.chmodSync(credPath, 0o600);
		} catch {
			/* best effort */
		}
	}
};

export const clearStoredCredentials = (): boolean => {
	const credPath = getCredentialsPath();
	if (fs.existsSync(credPath)) {
		try {
			fs.rmSync(credPath, { force: true });
			return true;
		} catch {
			return false;
		}
	}
	return false;
};

export const getActiveToken = (): ActiveTokenInfo | null => {
	const envToken = process.env.RAIGAL_TOKEN?.trim();
	if (envToken && envToken.length > 0) {
		return {
			token: envToken,
			source: "env",
			kind: detectTokenKind(envToken),
		};
	}

	const stored = loadStoredCredentials();
	if (stored) {
		return {
			token: stored.token,
			source: "file",
			kind: detectTokenKind(stored.token),
			org: stored.org,
			user: stored.user,
		};
	}

	return null;
};
