import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AllowedOwnerType } from "./types.js";

const GITHUB_REMOTE_RE =
	/^(?:git@github\.com:|https:\/\/(?:[^@]+@)?github\.com\/)([^/]+)\/([^/.\s]+?)(?:\.git)?\s*$/;

export interface DetectedRepoOwner {
	owner: string | null;
	repo: string | null;
	hasRemote: boolean;
	isGitHubRemote: boolean;
}

const parseGitRemote = (rawUrl: string | null): DetectedRepoOwner => {
	if (!rawUrl) {
		return {
			owner: null,
			repo: null,
			hasRemote: false,
			isGitHubRemote: false,
		};
	}

	const match = rawUrl.match(GITHUB_REMOTE_RE);
	if (!match || !match[1] || !match[2]) {
		return {
			owner: null,
			repo: null,
			hasRemote: true,
			isGitHubRemote: false,
		};
	}

	return {
		owner: match[1].toLowerCase(),
		repo: match[2].toLowerCase(),
		hasRemote: true,
		isGitHubRemote: true,
	};
};

const readGitConfigRemote = (dir: string): string | null => {
	let gitPath = path.join(dir, ".git");
	try {
		if (!fs.existsSync(gitPath)) return null;
		const stat = fs.statSync(gitPath);
		if (stat.isFile()) {
			const content = fs.readFileSync(gitPath, "utf-8");
			const match = content.match(/^gitdir:\s*(.+)$/m);
			if (match && match[1]) {
				gitPath = path.resolve(dir, match[1].trim());
			}
		}
		const configPath = path.join(gitPath, "config");
		if (!fs.existsSync(configPath)) return null;
		const configContent = fs.readFileSync(configPath, "utf-8");
		const originMatch = configContent.match(
			/\[remote\s+["']origin["']][^[]*\burl\s*=\s*([^\r\n]+)/,
		);
		if (originMatch && originMatch[1]) {
			return originMatch[1].trim();
		}
	} catch {
		return null;
	}
	return null;
};

const spawnGitRemote = (resolved: string): string | null => {
	try {
		const res = spawnSync("git", ["remote", "get-url", "origin"], {
			cwd: resolved,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});

		if (res.error || res.status !== 0) return null;
		const trimmed = res.stdout.trim();
		return trimmed || null;
	} catch {
		return null;
	}
};

const findGitRoot = (dir: string): string | null => {
	let current = path.resolve(dir);
	try {
		const stat = fs.statSync(current);
		if (stat.isFile()) current = path.dirname(current);
	} catch {
		// Ignore
	}
	while (true) {
		if (fs.existsSync(path.join(current, ".git"))) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
};

export const detectLocalRepoOwner = (directory: string): DetectedRepoOwner => {
	// In GitHub Actions or environments where GITHUB_REPOSITORY is set
	const envRepo = process.env.GITHUB_REPOSITORY?.trim();
	if (envRepo && envRepo.includes("/")) {
		const [owner = "", repo = ""] = envRepo.split("/");
		return {
			owner: owner.toLowerCase(),
			repo: repo.toLowerCase(),
			hasRemote: true,
			isGitHubRemote: true,
		};
	}

	const gitRoot = findGitRoot(directory);
	if (!gitRoot) {
		return {
			owner: null,
			repo: null,
			hasRemote: false,
			isGitHubRemote: false,
		};
	}

	const rawUrl = readGitConfigRemote(gitRoot);
	if (rawUrl !== null) {
		return parseGitRemote(rawUrl);
	}

	return parseGitRemote(spawnGitRemote(gitRoot));
};

const isNonGitHubCi = (): boolean => {
	const env = process.env;
	const isCi = env.CI === "true" || env.CI === "1";
	if (!isCi) return false;

	// Known non-GitHub CI environments
	return Boolean(
		env.GITLAB_CI ||
			env.BITBUCKET_BUILD_NUMBER ||
			(env.CIRCLECI && !env.CIRCLE_PROJECT_REPONAME?.includes("/")) ||
			env.BUILDKITE ||
			env.TRAVIS ||
			env.JENKINS_URL,
	);
};

export interface OwnerCheckResult {
	allowed: boolean;
	reason?: string;
	owner?: string;
}

export const checkOwnerAgainstAllowlist = (
	detected: DetectedRepoOwner,
	allowedOwners: AllowedOwnerType[],
	tokenKind: "session" | "api_key",
): OwnerCheckResult => {
	if (isNonGitHubCi()) {
		return {
			allowed: false,
			reason: "Non-GitHub CI environments are unsupported under organization allowlists.",
		};
	}

	if (!detected.hasRemote) {
		if (tokenKind === "session") {
			// Allowed for an interactive member session
			return { allowed: true };
		}
		// Blocked for org-key runs
		return {
			allowed: false,
			reason:
				"Repository has no GitHub remote. CI and API key runs require an origin remote matching an allowed organization.",
		};
	}

	if (!detected.isGitHubRemote || !detected.owner) {
		return {
			allowed: false,
			reason: "Repository remote is not hosted on GitHub or could not be determined.",
		};
	}

	const lowerOwner = detected.owner.toLowerCase();
	const isMatch = allowedOwners.some((allowed) => allowed.login.toLowerCase() === lowerOwner);

	if (!isMatch) {
		const allowedLogins = allowedOwners.map((o) => o.login).join(", ");
		return {
			allowed: false,
			owner: lowerOwner,
			reason: `GitHub owner '${detected.owner}' is not on the organization allowlist (${allowedLogins || "none"}).`,
		};
	}

	return { allowed: true, owner: lowerOwner };
};
