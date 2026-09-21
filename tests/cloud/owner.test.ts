import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkOwnerAgainstAllowlist,
	type DetectedRepoOwner,
} from "../../src/cloud/owner.js";

describe("repository owner allowlist check", () => {
	const allowedOwners = [
		{ id: 100, login: "acme-corp" },
		{ id: 200, login: "my-team" },
	];

	const originalEnv = { ...process.env };

	beforeEach(() => {
		delete process.env.CI;
		delete process.env.GITLAB_CI;
		delete process.env.BITBUCKET_BUILD_NUMBER;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("passes when owner matches allowlist", () => {
		const detected: DetectedRepoOwner = {
			owner: "acme-corp",
			repo: "my-project",
			hasRemote: true,
			isGitHubRemote: true,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "session");
		expect(result.allowed).toBe(true);
		expect(result.owner).toBe("acme-corp");
	});

	it("handles case insensitivity for repository owner", () => {
		const detected: DetectedRepoOwner = {
			owner: "ACME-CORP",
			repo: "my-project",
			hasRemote: true,
			isGitHubRemote: true,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "session");
		expect(result.allowed).toBe(true);
	});

	it("rejects when owner is not on allowlist", () => {
		const detected: DetectedRepoOwner = {
			owner: "unauthorized-org",
			repo: "my-project",
			hasRemote: true,
			isGitHubRemote: true,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "session");
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("not on the organization allowlist");
	});

	it("allows repos without a remote for interactive session tokens", () => {
		const detected: DetectedRepoOwner = {
			owner: null,
			repo: null,
			hasRemote: false,
			isGitHubRemote: false,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "session");
		expect(result.allowed).toBe(true);
	});

	it("blocks repos without a remote for org API keys", () => {
		const detected: DetectedRepoOwner = {
			owner: null,
			repo: null,
			hasRemote: false,
			isGitHubRemote: false,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "api_key");
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("require an origin remote matching an allowed organization");
	});

	it("blocks non-GitHub CI environments", () => {
		process.env.CI = "true";
		process.env.GITLAB_CI = "true";

		const detected: DetectedRepoOwner = {
			owner: "acme-corp",
			repo: "my-project",
			hasRemote: true,
			isGitHubRemote: true,
		};
		const result = checkOwnerAgainstAllowlist(detected, allowedOwners, "api_key");
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Non-GitHub CI environments are unsupported");
	});
});
