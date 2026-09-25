import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach } from "vitest";
import {
	registerPublicKeyForTests,
} from "../src/cloud/keys.js";
import {
	createValidTestClaims,
	generateTestKeyPair,
	signTestEntitlementJwt,
	TEST_KID,
	TEST_PUBLIC_KEY_PEM,
} from "./cloud/helpers.js";

// Ensure test key is registered
registerPublicKeyForTests(TEST_KID, TEST_PUBLIC_KEY_PEM);
process.env.RAIGAL_KEY_ID = TEST_KID;
process.env.RAIGAL_PUBLIC_KEY = TEST_PUBLIC_KEY_PEM;

// Prevent host environment tokens and repo configs from leaking into unit tests
delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
delete process.env.RAIGAL_TOKEN;
delete process.env.GITHUB_REPOSITORY;

// Create a stable test config directory with session credentials and cached entitlement
const testConfigDir = path.join(os.tmpdir(), "raigal-vitest-global-config");
fs.mkdirSync(testConfigDir, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const claims = createValidTestClaims({
	sub: "org_test",
	org_name: "Test Org",
	plan: "active",
	allowed_owners: [
		{ id: 1, login: "meethiu" },
		{ id: 2, login: "heavykenny" },
		{ id: 3, login: "acme" },
		{ id: 4, login: "test" },
	],
	exp: now + 365 * 86400,
});

const jwt = signTestEntitlementJwt(claims);

fs.writeFileSync(
	path.join(testConfigDir, "credentials.json"),
	JSON.stringify(
		{
			token: "rgl_cli_test_session_active",
			org: { id: "org_test", name: "Test Org" },
			user: { id: "usr_test", email: "test@raigal.dev" },
		},
		null,
		2,
	),
	{ mode: 0o600 },
);

fs.writeFileSync(
	path.join(testConfigDir, "entitlement.json"),
	JSON.stringify(
		{
			entitlement: jwt,
			refresh_after: now + 365 * 86400,
		},
		null,
		2,
	),
	{ mode: 0o600 },
);

process.env.RAIGAL_CONFIG_DIR = testConfigDir;

beforeEach(() => {
	process.env.RAIGAL_CONFIG_DIR = testConfigDir;
	delete process.env.RAIGAL_TOKEN;
	delete process.env.GITHUB_REPOSITORY;
});
