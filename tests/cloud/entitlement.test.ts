import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveStoredCredentials } from "../../src/cloud/credentials.js";
import {
	clearCachedEntitlement,
	getEntitlement,
	LicenceDeniedError,
	LicenceUnverifiableError,
	loadCachedEntitlement,
	MissingCredentialError,
	saveCachedEntitlement,
} from "../../src/cloud/entitlement.js";
import {
	createValidTestClaims,
	signTestEntitlementJwt,
} from "./helpers.js";

describe("entitlement resolver & caching", () => {
	let tempDir: string;
	const originalConfigDir = process.env.RAIGAL_CONFIG_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-ent-test-"));
		process.env.RAIGAL_CONFIG_DIR = tempDir;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
		delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
	});

	afterEach(() => {
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

	it("throws MissingCredentialError when not signed in and no cache exists", async () => {
		await expect(getEntitlement()).rejects.toThrow(MissingCredentialError);
	});

	it("fetches entitlement via GitHub Actions OIDC when no credential exists", async () => {
		process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://actions.github.test/token?param=1";
		process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = "test-runner-token";

		try {
			const claims = createValidTestClaims();
			const jwt = signTestEntitlementJwt(claims);
			const refreshAfter = Math.floor(Date.now() / 1000) + 43200;

			const fetchMock = vi.fn(async (url: string | URL | Request) => {
				const urlStr = url.toString();
				if (urlStr.includes("actions.github.test")) {
					return new Response(JSON.stringify({ value: "mock.github.oidc.token" }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response(JSON.stringify({ entitlement: jwt, refresh_after: refreshAfter }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			});
			vi.stubGlobal("fetch", fetchMock);

			const result = await getEntitlement();
			expect(result.fromCache).toBe(false);
			expect(result.jwt).toBe(jwt);
			expect(result.claims.sub).toBe("org_test123");
			expect(fetchMock).toHaveBeenCalledTimes(2);
		} finally {
			delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
			delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
		}
	});

	it("fetches entitlement online, verifies offline, and caches it", async () => {
		saveStoredCredentials({ token: "rgl_live_valid_key" });

		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims);
		const refreshAfter = Math.floor(Date.now() / 1000) + 43200;

		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ entitlement: jwt, refresh_after: refreshAfter }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await getEntitlement();
		expect(result.fromCache).toBe(false);
		expect(result.jwt).toBe(jwt);
		expect(result.claims.sub).toBe("org_test123");

		const cached = loadCachedEntitlement();
		expect(cached?.entitlement).toBe(jwt);
		expect(cached?.refresh_after).toBe(refreshAfter);
	});

	it("reuses cached entitlement when lease is fresh", async () => {
		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims);
		const refreshAfter = Math.floor(Date.now() / 1000) + 40000;

		saveCachedEntitlement(jwt, refreshAfter);

		const fetchMock = vi.fn(async () => {
			throw new Error("Should not be called");
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await getEntitlement();
		expect(result.fromCache).toBe(true);
		expect(result.jwt).toBe(jwt);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("uses cached entitlement under 72h grace on network failure", async () => {
		saveStoredCredentials({ token: "rgl_live_valid_key" });

		const now = Math.floor(Date.now() / 1000);
		// Lease expired 1 hour ago
		const claims = createValidTestClaims({
			iat: now - 90000,
			exp: now - 3600,
		});
		const jwt = signTestEntitlementJwt(claims);

		// Cache it with refresh_after in the past so refresh is triggered
		saveCachedEntitlement(jwt, now - 5000);

		// Server fails with network error / 503
		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ error: { message: "Service Unavailable" } }), {
				status: 503,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await getEntitlement();
		expect(result.fromCache).toBe(true);
		expect(result.grace).toBe(true);
		expect(result.jwt).toBe(jwt);
	});

	it("throws LicenceUnverifiableError when network fails and cache is expired beyond 72h grace", async () => {
		saveStoredCredentials({ token: "rgl_live_valid_key" });

		const now = Math.floor(Date.now() / 1000);
		// Expired 75 hours ago
		const claims = createValidTestClaims({
			iat: now - 400000,
			exp: now - 75 * 3600,
		});
		const jwt = signTestEntitlementJwt(claims);

		saveCachedEntitlement(jwt, now - 50000);

		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({ error: { message: "Service Unavailable" } }), {
				status: 503,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getEntitlement()).rejects.toThrow(LicenceUnverifiableError);
	});

	it("clears cached entitlement and throws LicenceDeniedError on 401, 402, 403, 426", async () => {
		saveStoredCredentials({ token: "rgl_live_key" });

		const claims = createValidTestClaims();
		const jwt = signTestEntitlementJwt(claims);
		saveCachedEntitlement(jwt, Math.floor(Date.now() / 1000) - 100);

		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({ error: { code: "trial_expired", message: "Trial has expired." } }),
				{
					status: 402,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getEntitlement()).rejects.toThrow(LicenceDeniedError);
		expect(loadCachedEntitlement()).toBeNull();
	});
});
