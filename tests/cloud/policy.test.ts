import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyPolicyToConfig,
	fetchRemotePolicy,
	isKeyLocked,
	loadCachedPolicy,
	saveCachedPolicy,
} from "../../src/cloud/policy.js";
import type { PolicyType } from "../../src/cloud/types.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import type { AislopConfig } from "../../src/config/index.js";

const createMockPolicy = (overrides: Partial<PolicyType> = {}): PolicyType => ({
	version: 1,
	hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
	config: {
		ci: { failBelow: 80 },
		rules: {
			"security/hardcoded-secret": "error",
			"ai-slop/trivial-comment": "warning",
		},
		exclude: ["generated/**"],
	},
	locked: ["ci.failBelow", "rules.security/hardcoded-secret"],
	...overrides,
});

describe("remote policy fetch, caching, and merge", () => {
	let tempDir: string;
	const originalStateDir = process.env.RAIGAL_STATE_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-policy-test-"));
		process.env.RAIGAL_STATE_DIR = tempDir;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		if (originalStateDir !== undefined) {
			process.env.RAIGAL_STATE_DIR = originalStateDir;
		} else {
			delete process.env.RAIGAL_STATE_DIR;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe("caching and fetch", () => {
		it("caches policy locally and reloads it", () => {
			const policy = createMockPolicy();
			saveCachedPolicy("acme/my-repo", policy);

			const loaded = loadCachedPolicy("acme/my-repo");
			expect(loaded?.hash).toBe(policy.hash);
			expect(loaded?.config?.ci?.failBelow).toBe(80);
		});

		it("fetches remote policy from API and saves to cache", async () => {
			const policy = createMockPolicy({ version: 2 });
			const fetchMock = vi.fn(async () =>
				new Response(JSON.stringify(policy), { status: 200, headers: { "Content-Type": "application/json" } }),
			);
			vi.stubGlobal("fetch", fetchMock);

			const result = await fetchRemotePolicy("acme/my-repo", "token_123");
			expect(result?.version).toBe(2);

			const cached = loadCachedPolicy("acme/my-repo");
			expect(cached?.version).toBe(2);
		});
	});

	describe("isKeyLocked pattern matching", () => {
		it("matches exact keys", () => {
			expect(isKeyLocked("ci.failBelow", ["ci.failBelow"])).toBe(true);
			expect(isKeyLocked("ci.format", ["ci.failBelow"])).toBe(false);
		});

		it("matches wildcards", () => {
			expect(isKeyLocked("rules.security/hardcoded-secret", ["rules.*"])).toBe(true);
			expect(isKeyLocked("rules.ai-slop/dead-code", ["rules/*"])).toBe(true);
			expect(isKeyLocked("exclude", ["rules.*"])).toBe(false);
		});
	});

	describe("applyPolicyToConfig", () => {
		it("enforces locked ci.failBelow over local config", () => {
			const localConfig: AislopConfig = {
				...DEFAULT_CONFIG,
				ci: { failBelow: 50, format: "json" },
			};
			const policy = createMockPolicy({
				config: { ci: { failBelow: 85 } },
				locked: ["ci.failBelow"],
			});

			const { config, lockedOverrides } = applyPolicyToConfig(localConfig, policy);
			expect(config.ci.failBelow).toBe(85);
			expect(lockedOverrides).toContain("ci.failBelow");
		});

		it("enforces locked rules over local rule configuration", () => {
			const localConfig: AislopConfig = {
				...DEFAULT_CONFIG,
				rules: {
					"security/hardcoded-secret": "off",
					"ai-slop/trivial-comment": "off",
				},
			};
			const policy = createMockPolicy({
				config: {
					rules: {
						"security/hardcoded-secret": "error",
						"ai-slop/trivial-comment": "warning",
					},
				},
				locked: ["rules.security/hardcoded-secret"],
			});

			const { config, lockedOverrides } = applyPolicyToConfig(localConfig, policy);
			expect(config.rules["security/hardcoded-secret"]).toBe("error");
			expect(lockedOverrides).toContain("rules.security/hardcoded-secret");
			// Unlocked rule stays as configured locally
			expect(config.rules["ai-slop/trivial-comment"]).toBe("off");
		});

		it("merges remote exclude patterns into local exclude", () => {
			const localConfig: AislopConfig = {
				...DEFAULT_CONFIG,
				exclude: ["local-vendor/**"],
			};
			const policy = createMockPolicy({
				config: {
					exclude: ["remote-vendor/**"],
				},
			});

			const { config } = applyPolicyToConfig(localConfig, policy);
			expect(config.exclude).toContain("local-vendor/**");
			expect(config.exclude).toContain("remote-vendor/**");
		});
	});
});
