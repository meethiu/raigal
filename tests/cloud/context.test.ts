import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	detectCiContext,
	detectGitContext,
	detectRepoRef,
	getRootCommitHash,
} from "../../src/cloud/context.js";

describe("cloud context detection", () => {
	let tempDir: string;
	const originalEnv = { ...process.env };

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-context-test-"));
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe("detectRepoRef", () => {
		it("detects GitHub repo slug and root commit from GITHUB_REPOSITORY", () => {
			process.env.GITHUB_REPOSITORY = "Acme-Corp/Project-Raigal";
			const ref = detectRepoRef(process.cwd(), 999);
			expect(ref).not.toBeNull();
			expect(ref?.provider).toBe("github");
			expect(ref?.slug).toBe("acme-corp/project-raigal");
			expect(ref?.owner_id).toBe(999);
		});

		it("returns null when no git remote exists", () => {
			delete process.env.GITHUB_REPOSITORY;
			const ref = detectRepoRef(tempDir);
			expect(ref).toBeNull();
		});

		it("reads root commit hash when git history is available", () => {
			const root = getRootCommitHash(process.cwd());
			if (root) {
				expect(root).toMatch(/^[0-9a-f]{40,64}$/i);
			}
		});
	});

	describe("detectGitContext", () => {
		it("extracts PR head sha and branch from GITHUB_EVENT_PATH payload", () => {
			const eventPayload = {
				pull_request: {
					number: 42,
					head: {
						sha: "1111222233334444555566667777888899990000",
					},
					base: {
						ref: "main",
					},
				},
			};

			const eventFile = path.join(tempDir, "event.json");
			fs.writeFileSync(eventFile, JSON.stringify(eventPayload));

			process.env.GITHUB_EVENT_PATH = eventFile;
			process.env.GITHUB_SHA = "merge_commit_sha_should_not_be_used";
			process.env.GITHUB_HEAD_REF = "feature-branch";

			const git = detectGitContext(process.cwd());
			expect(git.head_sha).toBe("1111222233334444555566667777888899990000");
			expect(git.branch).toBe("feature-branch");
			expect(git.base_ref).toBe("main");
			expect(git.pr_number).toBe(42);
		});

		it("falls back to GITHUB_SHA when not a PR event", () => {
			delete process.env.GITHUB_EVENT_PATH;
			process.env.GITHUB_SHA = "commit_sha_push";
			process.env.GITHUB_REF_NAME = "develop";

			const git = detectGitContext(process.cwd());
			expect(git.head_sha).toBe("commit_sha_push");
			expect(git.branch).toBe("develop");
		});
	});

	describe("detectCiContext", () => {
		it("returns github-actions provider and constructs run_url", () => {
			process.env.GITHUB_ACTIONS = "true";
			process.env.GITHUB_SERVER_URL = "https://github.com";
			process.env.GITHUB_REPOSITORY = "acme/repo";
			process.env.GITHUB_RUN_ID = "12345678";
			process.env.GITHUB_RUN_ATTEMPT = "1";

			const ci = detectCiContext();
			expect(ci?.provider).toBe("github-actions");
			expect(ci?.run_url).toBe("https://github.com/acme/repo/actions/runs/12345678/attempts/1");
		});

		it("detects gitlab-ci when GITLAB_CI is set", () => {
			delete process.env.GITHUB_ACTIONS;
			process.env.CI = "true";
			process.env.GITLAB_CI = "true";

			const ci = detectCiContext();
			expect(ci?.provider).toBe("gitlab-ci");
		});

		it("returns undefined when running locally without CI flags", () => {
			delete process.env.GITHUB_ACTIONS;
			delete process.env.CI;

			const ci = detectCiContext();
			expect(ci).toBeUndefined();
		});
	});
});
