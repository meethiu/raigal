import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { detectLocalRepoOwner } from "./owner.js";
import type { RepoRefType } from "./types.js";

export interface GitContextResult {
	branch?: string;
	head_sha?: string;
	base_ref?: string;
	pr_number?: number;
	diff_summary?: {
		files_changed: number;
		additions: number;
		deletions: number;
	};
	diff_preview?: string;
}

export interface CiContextResult {
	provider: string;
	run_url?: string;
}

const execGit = (args: string[], cwd: string): string | undefined => {
	try {
		const res = spawnSync("git", args, {
			cwd: path.resolve(cwd),
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		if (res.error || res.status !== 0) return undefined;
		const trimmed = res.stdout.trim();
		return trimmed || undefined;
	} catch {
		return undefined;
	}
};

const detectDefaultBranch = (directory: string): string => {
	try {
		const out = execGit(["symbolic-ref", "refs/remotes/origin/HEAD"], directory);
		if (out && out.startsWith("refs/remotes/origin/")) {
			return out.replace("refs/remotes/origin/", "").trim();
		}
	} catch {
		// fallback
	}
	return "main";
};

export const detectGitDiff = (
	directory: string,
	baseRef?: string,
): {
	diffSummary?: { files_changed: number; additions: number; deletions: number };
	diffPreview?: string;
} => {
	const targetBase = baseRef || detectDefaultBranch(directory);
	try {
		let shortstat = execGit(["diff", "--shortstat", `${targetBase}...HEAD`], directory);
		if (!shortstat) {
			shortstat = execGit(["diff", "--shortstat", `origin/${targetBase}...HEAD`], directory);
		}
		if (!shortstat) {
			shortstat = execGit(["diff", "--shortstat", "HEAD~1"], directory);
		}

		let diffSummary: { files_changed: number; additions: number; deletions: number } | undefined;
		if (shortstat) {
			const filesMatch = shortstat.match(/(\d+)\s+files?\s+changed/);
			const addMatch = shortstat.match(/(\d+)\s+insertions?\s*\(\+\)/);
			const delMatch = shortstat.match(/(\d+)\s+deletions?\s*\(-\)/);
			diffSummary = {
				files_changed: filesMatch ? Number.parseInt(filesMatch[1], 10) : 1,
				additions: addMatch ? Number.parseInt(addMatch[1], 10) : 0,
				deletions: delMatch ? Number.parseInt(delMatch[1], 10) : 0,
			};
		}

		let preview = execGit(["diff", "-U2", "--no-color", `${targetBase}...HEAD`], directory);
		if (!preview) {
			preview = execGit(["diff", "-U2", "--no-color", `origin/${targetBase}...HEAD`], directory);
		}
		if (!preview) {
			preview = execGit(["diff", "-U2", "--no-color", "HEAD~1"], directory);
		}

		let diffPreview: string | undefined;
		if (preview) {
			const lines = preview.split("\n").slice(0, 40);
			diffPreview = lines.join("\n").slice(0, 10000);
		}

		return { diffSummary, diffPreview };
	} catch {
		return {};
	}
};

export const getRootCommitHash = (directory: string): string | undefined => {
	// git rev-list --max-parents=0 --abbrev-commit=no HEAD
	const hash = execGit(["rev-list", "--max-parents=0", "HEAD"], directory);
	if (!hash) return undefined;
	const firstLine = hash.split("\n")[0]?.trim();
	return firstLine && /^[0-9a-f]{40,64}$/i.test(firstLine) ? firstLine : undefined;
};

export const detectRepoRef = (directory: string, ownerId?: number): RepoRefType | null => {
	const detected = detectLocalRepoOwner(directory);
	if (!detected.owner || !detected.repo) {
		return null;
	}

	const slug = `${detected.owner}/${detected.repo}`.toLowerCase();
	const rootCommit = getRootCommitHash(directory);

	return {
		provider: "github",
		slug,
		owner_id: ownerId,
		root_commit_hash: rootCommit,
	};
};

interface GitHubPrEventPayload {
	pull_request?: {
		number?: number;
		head?: {
			sha?: string;
		};
		base?: {
			ref?: string;
		};
	};
	number?: number;
}

const readGitHubEventPayload = (): GitHubPrEventPayload | null => {
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (!eventPath || !fs.existsSync(eventPath)) return null;

	try {
		const content = fs.readFileSync(eventPath, "utf-8");
		return JSON.parse(content) as GitHubPrEventPayload;
	} catch {
		return null;
	}
};

export const detectGitContext = (directory: string): GitContextResult => {
	const eventPayload = readGitHubEventPayload();
	const pr = eventPayload?.pull_request;

	// In PR events, head_sha must be the PR head SHA, not the merge commit SHA
	let headSha = pr?.head?.sha;
	if (!headSha) {
		headSha = process.env.GITHUB_SHA || execGit(["rev-parse", "HEAD"], directory);
	}

	let branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
	if (!branch) {
		branch = execGit(["rev-parse", "--abbrev-ref", "HEAD"], directory);
		if (branch === "HEAD") {
			// Detached HEAD
			branch = undefined;
		}
	}

	let baseRef = pr?.base?.ref || process.env.GITHUB_BASE_REF;
	if (!baseRef) baseRef = undefined;

	let prNumber: number | undefined;
	if (typeof pr?.number === "number") {
		prNumber = pr.number;
	} else if (typeof eventPayload?.number === "number") {
		prNumber = eventPayload.number;
	} else if (process.env.RAIGAL_PR_NUMBER || process.env.PR_NUMBER) {
		const parsed = Number.parseInt(process.env.RAIGAL_PR_NUMBER || process.env.PR_NUMBER || "", 10);
		if (!Number.isNaN(parsed) && parsed > 0) prNumber = parsed;
	} else if (process.env.GITHUB_REF) {
		const match = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)(?:\/|$)/);
		if (match && match[1]) {
			prNumber = Number.parseInt(match[1], 10);
		}
	}
	if (!prNumber && branch) {
		const match = branch.match(/pull\/(\d+)/i) || branch.match(/^pr-(\d+)/i);
		if (match && match[1]) {
			prNumber = Number.parseInt(match[1], 10);
		}
	}

	const result: GitContextResult = {};
	if (branch) result.branch = branch;
	if (headSha) result.head_sha = headSha;
	if (baseRef) result.base_ref = baseRef;
	if (prNumber !== undefined && !Number.isNaN(prNumber)) result.pr_number = prNumber;

	const { diffSummary, diffPreview } = detectGitDiff(directory, baseRef);
	if (diffSummary) result.diff_summary = diffSummary;
	if (diffPreview) result.diff_preview = diffPreview;

	return result;
};

export const detectCiContext = (): CiContextResult | undefined => {
	if (process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_ACTIONS === "1") {
		const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
		const repo = process.env.GITHUB_REPOSITORY;
		const runId = process.env.GITHUB_RUN_ID;

		let runUrl: string | undefined;
		if (repo && runId) {
			const attempt = process.env.GITHUB_RUN_ATTEMPT;
			const attemptSuffix = attempt ? `/attempts/${attempt}` : "";
			runUrl = `${serverUrl}/${repo}/actions/runs/${runId}${attemptSuffix}`;
		}

		return {
			provider: "github-actions",
			...(runUrl ? { run_url: runUrl } : {}),
		};
	}

	if (process.env.CI === "true" || process.env.CI === "1") {
		const provider =
			(process.env.GITLAB_CI && "gitlab-ci") ||
			(process.env.BITBUCKET_BUILD_NUMBER && "bitbucket-pipelines") ||
			(process.env.CIRCLECI && "circleci") ||
			(process.env.BUILDKITE && "buildkite") ||
			(process.env.TRAVIS && "travis-ci") ||
			"generic-ci";

		return { provider };
	}

	return undefined;
};
