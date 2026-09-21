import fs from "node:fs";
import path from "node:path";
import type { AislopConfig } from "../config/index.js";
import { requestApi } from "./client.js";
import { Policy } from "./contract.js";
import { getPolicyCachePath } from "./paths.js";
import type { PolicyType } from "./types.js";

interface CachedPolicyEntry {
	policy: PolicyType;
	fetched_at: number;
}

interface PolicyCacheMap {
	[repoSlug: string]: CachedPolicyEntry;
}

export const loadAllCachedPolicies = (): PolicyCacheMap => {
	const p = getPolicyCachePath();
	if (!fs.existsSync(p)) return {};

	try {
		const content = fs.readFileSync(p, "utf-8");
		return JSON.parse(content) as PolicyCacheMap;
	} catch {
		return {};
	}
};

export const loadCachedPolicy = (repoSlug: string): PolicyType | null => {
	const cache = loadAllCachedPolicies();
	const entry = cache[repoSlug.toLowerCase()];
	return entry ? entry.policy : null;
};

export const saveCachedPolicy = (repoSlug: string, policy: PolicyType): void => {
	const p = getPolicyCachePath();
	const dir = path.dirname(p);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const cache = loadAllCachedPolicies();
	cache[repoSlug.toLowerCase()] = {
		policy,
		fetched_at: Math.floor(Date.now() / 1000),
	};

	const temp = `${p}.${Date.now()}.tmp`;
	fs.writeFileSync(temp, JSON.stringify(cache, null, 2), { mode: 0o600 });
	try {
		fs.renameSync(temp, p);
	} catch {
		fs.rmSync(temp, { force: true });
		fs.writeFileSync(p, JSON.stringify(cache, null, 2), { mode: 0o600 });
	}
};

export const fetchRemotePolicy = async (
	repoSlug: string,
	token: string,
): Promise<PolicyType | null> => {
	try {
		const endpoint = `/v1/policy?repo=${encodeURIComponent(repoSlug.toLowerCase())}`;
		const data = await requestApi<unknown>(endpoint, {
			method: "GET",
			token,
			timeoutMs: 4000,
		});

		const policy = Policy.parse(data);
		saveCachedPolicy(repoSlug, policy);
		return policy;
	} catch {
		// If offline or network fails, fall back to cached policy if available
		return loadCachedPolicy(repoSlug);
	}
};

export const isKeyLocked = (keyPath: string, lockedList: string[]): boolean => {
	for (const locked of lockedList) {
		if (locked === keyPath) return true;
		if (locked.endsWith("/*") || locked.endsWith(".*")) {
			const prefix = locked.slice(0, -2);
			if (
				keyPath === prefix ||
				keyPath.startsWith(`${prefix}.`) ||
				keyPath.startsWith(`${prefix}/`)
			) {
				return true;
			}
		}
	}
	return false;
};

export interface ApplyPolicyResult {
	config: AislopConfig;
	lockedOverrides: string[];
}

export const applyPolicyToConfig = (
	localConfig: AislopConfig,
	policy: PolicyType,
): ApplyPolicyResult => {
	const config: AislopConfig = JSON.parse(JSON.stringify(localConfig));
	const lockedOverrides: string[] = [];

	// 1. CI failBelow
	if (policy.config?.ci?.failBelow !== undefined) {
		if (isKeyLocked("ci.failBelow", policy.locked)) {
			if (
				localConfig.ci.failBelow !== undefined &&
				localConfig.ci.failBelow !== policy.config.ci.failBelow
			) {
				lockedOverrides.push("ci.failBelow");
			}
			config.ci.failBelow = policy.config.ci.failBelow;
		} else if (localConfig.ci.failBelow === undefined) {
			config.ci.failBelow = policy.config.ci.failBelow;
		}
	}

	// 2. Exclude patterns (combine)
	if (policy.config?.exclude && Array.isArray(policy.config.exclude)) {
		const combined = new Set([...config.exclude, ...policy.config.exclude]);
		config.exclude = Array.from(combined);
	}

	// 3. Rules
	if (policy.config?.rules) {
		for (const [ruleId, remoteSeverity] of Object.entries(policy.config.rules)) {
			const ruleKey = `rules.${ruleId}`;
			const locked = isKeyLocked(ruleKey, policy.locked) || isKeyLocked("rules", policy.locked);

			if (locked) {
				const localSeverity = localConfig.rules?.[ruleId];
				if (localSeverity && localSeverity !== remoteSeverity) {
					lockedOverrides.push(ruleKey);
				}
				config.rules[ruleId] = remoteSeverity;
			} else if (config.rules[ruleId] === undefined) {
				config.rules[ruleId] = remoteSeverity;
			}
		}
	}

	return { config, lockedOverrides };
};
