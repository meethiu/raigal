import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearStoredCredentials,
	getActiveToken,
	saveStoredCredentials,
} from "../../src/cloud/credentials.js";
import {
	loadCachedEntitlement,
	saveCachedEntitlement,
} from "../../src/cloud/entitlement.js";
import { loginCommand } from "../../src/commands/login.js";
import { logoutCommand } from "../../src/commands/logout.js";
import { whoamiCommand } from "../../src/commands/whoami.js";
import { createValidTestClaims, signTestEntitlementJwt } from "./helpers.js";

describe("device login, logout, and whoami commands", () => {
	let tempDir: string;
	const originalConfigDir = process.env.RAIGAL_CONFIG_DIR;
	const originalExitCode = process.exitCode;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-login-test-"));
		process.env.RAIGAL_CONFIG_DIR = tempDir;
		process.exitCode = 0;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		process.exitCode = originalExitCode;
		if (originalConfigDir !== undefined) {
			process.env.RAIGAL_CONFIG_DIR = originalConfigDir;
		} else {
			delete process.env.RAIGAL_CONFIG_DIR;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("completes device login flow when server approves with ok", async () => {
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);

		let pollCount = 0;
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr.endsWith("/v1/device/code")) {
				return new Response(
					JSON.stringify({
						device_code: "dev_123",
						user_code: "ABCD-EFGH",
						verification_uri: "https://app.raigal.dev/device",
						verification_uri_complete: "https://app.raigal.dev/device?code=ABCD-EFGH",
						expires_in: 60,
						interval: 0,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.endsWith("/v1/device/token")) {
				pollCount++;
				if (pollCount === 1) {
					return new Response(
						JSON.stringify({ error: "authorization_pending" }),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response(
					JSON.stringify({
						access_token: "rgl_cli_session_token_123",
						token_type: "bearer",
						expires_at: "2026-12-31T00:00:00Z",
						org: { id: "org_1", name: "Test Org" },
						user: { id: "usr_1", email: "developer@example.com" },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("Not found", { status: 404 });
		});

		vi.stubGlobal("fetch", fetchMock);

		await loginCommand({});

		const active = getActiveToken();
		expect(active).not.toBeNull();
		expect(active?.token).toBe("rgl_cli_session_token_123");
		expect(active?.kind).toBe("session");
		expect(active?.org?.name).toBe("Test Org");
		expect(active?.user?.email).toBe("developer@example.com");
	});

	it("supports --with-token option to save pasted token", async () => {
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		vi.spyOn(process.stderr, "write").mockImplementation(() => true);

		// Mock readline to simulate pasting token
		vi.spyOn(readline, "createInterface").mockImplementation((() => {
			const handlers: Record<string, Function> = {};
			const mockRl = {
				on: (event: string, handler: Function) => {
					handlers[event] = handler;
					if (event === "close") {
						setTimeout(() => {
							if (handlers.line) handlers.line("rgl_live_mock_pasted_token");
							handler();
						}, 0);
					}
					return mockRl;
				},
				close: () => {},
			};
			return mockRl as unknown as readline.Interface;
		}) as unknown as typeof readline.createInterface);

		await loginCommand({ withToken: true });

		const active = getActiveToken();
		expect(active).not.toBeNull();
		expect(active?.token).toBe("rgl_live_mock_pasted_token");
		expect(active?.kind).toBe("api_key");
	});

	it("handles login denied error by setting exit code 1", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr.endsWith("/v1/device/code")) {
				return new Response(
					JSON.stringify({
						device_code: "dev_denied",
						user_code: "DENY-1234",
						verification_uri: "https://app.raigal.dev/device",
						verification_uri_complete: "https://app.raigal.dev/device?code=DENY-1234",
						expires_in: 60,
						interval: 0,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.endsWith("/v1/device/token")) {
				return new Response(
					JSON.stringify({ error: "access_denied", error_description: "The user denied authorization" }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("Not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await loginCommand({});
		expect(process.exitCode).toBe(1);
	});

	it("handles login expired error by setting exit code 1", async () => {
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr.endsWith("/v1/device/code")) {
				return new Response(
					JSON.stringify({
						device_code: "dev_exp",
						user_code: "EXPD-1234",
						verification_uri: "https://app.raigal.dev/device",
						verification_uri_complete: "https://app.raigal.dev/device?code=EXPD-1234",
						expires_in: 60,
						interval: 0,
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.endsWith("/v1/device/token")) {
				return new Response(
					JSON.stringify({ error: "expired_token" }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("Not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await loginCommand({});
		expect(process.exitCode).toBe(1);
	});

	it("logs out, calls revoke api for session token, and purges credentials and cache", async () => {
		saveStoredCredentials({
			token: "rgl_cli_session_to_revoke",
			org: { id: "org_1", name: "Test Org" },
			user: { id: "u_1", email: "test@example.com" },
		});
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims);
		saveCachedEntitlement(jwt, Math.floor(Date.now() / 1000) + 3600);

		let revoked = false;
		const fetchMock = vi.fn(async (url: string | URL | Request) => {
			if (url.toString().endsWith("/v1/logout")) {
				revoked = true;
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			}
			return new Response("Not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await logoutCommand();

		expect(revoked).toBe(true);
		expect(getActiveToken()).toBeNull();
		expect(loadCachedEntitlement()).toBeNull();
	});

	it("whoami prints unauthenticated state when not logged in", async () => {
		let output = "";
		vi.spyOn(process.stdout, "write").mockImplementation((str) => {
			output += String(str);
			return true;
		});
		await whoamiCommand();
		expect(output).toContain("Not signed in");
	});

	it("whoami prints organization, user, plan, and allowed owners when logged in", async () => {
		saveStoredCredentials({
			token: "rgl_live_key_test",
			org: { id: "org_123", name: "Acme Corp" },
		});

		const claims = createValidTestClaims({
			org_name: "Acme Corp",
			plan: "active",
			allowed_owners: [{ id: 1, login: "acme-corp" }],
		});
		const jwt = signTestEntitlementJwt(claims);
		saveCachedEntitlement(jwt, Math.floor(Date.now() / 1000) + 3600);

		let output = "";
		vi.spyOn(process.stdout, "write").mockImplementation((str) => {
			output += String(str);
			return true;
		});

		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					org: { id: "org_123", name: "Acme Corp" },
					plan: "active",
					allowed_owners: [{ id: 1, login: "acme-corp" }],
					trial_started_at: null,
					trial_ends_at: null,
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await whoamiCommand();

		expect(output).toContain("Acme Corp");
		expect(output).toContain("acme-corp");
		expect(output).toContain("active");
	});
});
