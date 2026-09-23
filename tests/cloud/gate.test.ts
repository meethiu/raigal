import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveStoredCredentials } from "../../src/cloud/credentials.js";
import {
	LicenceDeniedError,
	LicenceUnverifiableError,
	MissingCredentialError,
	saveCachedEntitlement,
} from "../../src/cloud/entitlement.js";
import { requireEntitlement } from "../../src/cloud/gate.js";
import { agentCommand } from "../../src/commands/agent.js";
import { badgeCommand } from "../../src/commands/badge.js";
import { fixCommand } from "../../src/commands/fix.js";
import { initCommand } from "../../src/commands/init.js";
import { scanCommand } from "../../src/commands/scan.js";
import { trendCommand } from "../../src/commands/trend.js";
import { maybeRunRaigal } from "../../src/framework-adapters/core.js";
import { runScopedScan } from "../../src/hooks/io/scoped-scan.js";
import { createValidTestClaims, signTestEntitlementJwt } from "./helpers.js";

describe("requireEntitlement gate", () => {
	let tempDir: string;
	const originalConfigDir = process.env.RAIGAL_CONFIG_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-gate-test-"));
		process.env.RAIGAL_CONFIG_DIR = tempDir;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		if (originalConfigDir !== undefined) {
			process.env.RAIGAL_CONFIG_DIR = originalConfigDir;
		} else {
			delete process.env.RAIGAL_CONFIG_DIR;
		}
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe("gate modes", () => {
		it("mode: throw throws MissingCredentialError when not signed in", async () => {
			await expect(requireEntitlement({ mode: "throw" })).rejects.toThrow(
				MissingCredentialError,
			);
		});

		it("mode: fatal calls process.exit(30) when not signed in", async () => {
			const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
				throw new Error(`EXIT_${code}`);
			});
			const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			await expect(requireEntitlement({ mode: "fatal" })).rejects.toThrow("EXIT_30");
			expect(exitSpy).toHaveBeenCalledWith(30);
			expect(stderrSpy).toHaveBeenCalled();
		});

		it("mode: fatal calls process.exit(30) when repository owner is not allowed", async () => {
			saveStoredCredentials({ token: "rgl_live_key_123" });
			const claims = createValidTestClaims({
				allowed_owners: [{ id: 99, login: "allowed-org" }],
			});
			const jwt = signTestEntitlementJwt(claims);
			saveCachedEntitlement(jwt, Math.floor(Date.now() / 1000) + 3600);

			const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
				throw new Error(`EXIT_${code}`);
			});
			vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			await expect(
				requireEntitlement({
					mode: "fatal",
					repoOwner: "disallowed-org",
				}),
			).rejects.toThrow("EXIT_30");
			expect(exitSpy).toHaveBeenCalledWith(30);
		});

		it("mode: fatal calls process.exit(31) on network outage beyond grace period", async () => {
			saveStoredCredentials({ token: "rgl_live_key_123" });
			const now = Math.floor(Date.now() / 1000);
			const claims = createValidTestClaims({
				iat: now - 500000,
				exp: now - 75 * 3600, // Expired 75 hours ago (beyond 72h grace)
			});
			const jwt = signTestEntitlementJwt(claims);
			saveCachedEntitlement(jwt, now - 200000);

			const fetchMock = vi.fn(async () =>
				new Response(JSON.stringify({ error: { message: "down" } }), { status: 503 }),
			);
			vi.stubGlobal("fetch", fetchMock);

			const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
				throw new Error(`EXIT_${code}`);
			});
			vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			await expect(requireEntitlement({ mode: "fatal" })).rejects.toThrow("EXIT_31");
			expect(exitSpy).toHaveBeenCalledWith(31);
		});

		it("mode: quiet returns ok: false without exiting on missing entitlement", async () => {
			const exitSpy = vi.spyOn(process, "exit");
			const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			const result = await requireEntitlement({ mode: "quiet" });
			expect(result.ok).toBe(false);
			expect(result.exitCode).toBe(30);
			expect(exitSpy).not.toHaveBeenCalled();
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[raigal]"));
		});

		it("succeeds and returns ok: true when credentials and owner are valid", async () => {
			saveStoredCredentials({ token: "rgl_live_key_123" });
			const claims = createValidTestClaims({
				allowed_owners: [{ id: 1, login: "my-org" }],
			});
			const jwt = signTestEntitlementJwt(claims);
			saveCachedEntitlement(jwt, Math.floor(Date.now() / 1000) + 3600);

			const result = await requireEntitlement({
				mode: "fatal",
				repoOwner: "my-org",
			});

			expect(result.ok).toBe(true);
			expect(result.entitlement?.jwt).toBe(jwt);
		});
	});

	describe("fatal entry points", () => {
		const commands = [
			{ name: "scan", fn: () => scanCommand(".", {}) },
			{ name: "fix", fn: () => fixCommand(".", {}) },
			{ name: "init", fn: () => initCommand(".", { strict: true }) },
			{ name: "badge", fn: () => badgeCommand({ directory: "." }) },
			{ name: "trend", fn: () => trendCommand({ directory: "." }) },
			{ name: "agent", fn: () => agentCommand(".", {}) },
		];

		for (const { name, fn } of commands) {
			it(`blocks command ${name} with exit 30 when missing entitlement`, async () => {
				const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
					throw new Error(`EXIT_${code}`);
				});
				vi.spyOn(process.stderr, "write").mockImplementation(() => true);

				await expect(fn()).rejects.toThrow("EXIT_30");
				expect(exitSpy).toHaveBeenCalledWith(30);
			});
		}
	});

	describe("quiet entry points", () => {
		it("framework adapter handles exit 30/31 by continuing with exit 0 and skipped: true", async () => {
			const exitSpy = vi.spyOn(process, "exit");
			vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			const result = await maybeRunRaigal("vite", {
				enabled: true,
				runner: async () => ({
					command: "raigal",
					args: ["ci"],
					exitCode: 30,
					signal: null,
					skipped: false,
				}),
			});

			expect(result.exitCode).toBe(0);
			expect(result.skipped).toBe(true);
			expect(exitSpy).not.toHaveBeenCalled();
		});

		it("scoped scan hook returns empty diagnostics without exiting on unentitled repository", async () => {
			const exitSpy = vi.spyOn(process, "exit");
			vi.spyOn(process.stderr, "write").mockImplementation(() => true);

			const result = await runScopedScan(process.cwd(), []);
			expect(result.score).toBe(100);
			expect(result.diagnostics).toEqual([]);
			expect(exitSpy).not.toHaveBeenCalled();
		});
	});
});
