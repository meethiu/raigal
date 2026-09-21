import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	clearStoredCredentials,
	detectTokenKind,
	getActiveToken,
	loadStoredCredentials,
	saveStoredCredentials,
} from "../../src/cloud/credentials.js";

describe("credentials management", () => {
	let tempDir: string;
	const originalEnvToken = process.env.RAIGAL_TOKEN;
	const originalConfigDir = process.env.RAIGAL_CONFIG_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-cred-test-"));
		process.env.RAIGAL_CONFIG_DIR = tempDir;
		delete process.env.RAIGAL_TOKEN;
	});

	afterEach(() => {
		if (originalEnvToken !== undefined) {
			process.env.RAIGAL_TOKEN = originalEnvToken;
		} else {
			delete process.env.RAIGAL_TOKEN;
		}
		if (originalConfigDir !== undefined) {
			process.env.RAIGAL_CONFIG_DIR = originalConfigDir;
		} else {
			delete process.env.RAIGAL_CONFIG_DIR;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("detects token kind correctly", () => {
		expect(detectTokenKind("rgl_live_1234567890")).toBe("api_key");
		expect(detectTokenKind("rgl_cli_1234567890")).toBe("session");
	});

	it("saves and loads credentials with owner-only permissions", () => {
		expect(loadStoredCredentials()).toBeNull();

		saveStoredCredentials({
			token: "rgl_cli_session_token_123",
			org: { id: "org_1", name: "Acme" },
			user: { id: "user_1", email: "alice@acme.com" },
			expires_at: "2026-12-31T00:00:00Z",
		});

		const loaded = loadStoredCredentials();
		expect(loaded).not.toBeNull();
		expect(loaded?.token).toBe("rgl_cli_session_token_123");
		expect(loaded?.org?.name).toBe("Acme");
		expect(loaded?.user?.email).toBe("alice@acme.com");

		if (process.platform !== "win32") {
			const stat = fs.statSync(path.join(tempDir, "credentials.json"));
			// 0o600 permissions check
			expect(stat.mode & 0o777).toBe(0o600);
		}
	});

	it("clears stored credentials", () => {
		saveStoredCredentials({ token: "rgl_live_key_999" });
		expect(loadStoredCredentials()).not.toBeNull();

		clearStoredCredentials();
		expect(loadStoredCredentials()).toBeNull();
	});

	it("prioritizes RAIGAL_TOKEN environment variable over stored credentials", () => {
		saveStoredCredentials({
			token: "rgl_cli_file_token",
			org: { id: "org_file", name: "File Org" },
		});

		const fileActive = getActiveToken();
		expect(fileActive?.source).toBe("file");
		expect(fileActive?.token).toBe("rgl_cli_file_token");

		process.env.RAIGAL_TOKEN = "rgl_live_env_key";
		const envActive = getActiveToken();
		expect(envActive?.source).toBe("env");
		expect(envActive?.token).toBe("rgl_live_env_key");
		expect(envActive?.kind).toBe("api_key");
	});
});
