import type { Diagnostic, EngineResult, Severity } from "./types.js";

export interface EquivalenceGroup {
	id: string;
	rules: readonly string[];
}

export const EQUIVALENCE_GROUPS: readonly EquivalenceGroup[] = [
	{
		id: "eval",
		rules: [
			"security/eval",
			"eslint/no-eval",
			"typescript/no-implied-eval",
			"eslint/no-implied-eval",
		],
	},
	{
		id: "unused-import",
		rules: ["ai-slop/unused-import", "eslint/no-unused-vars", "typescript/no-unused-vars"],
	},
	{
		id: "constant-condition",
		rules: ["ai-slop/constant-condition", "eslint/no-constant-condition"],
	},
	{
		id: "swallowed-exception",
		rules: ["ai-slop/swallowed-exception", "eslint/no-empty", "ai-slop/python-bare-except"],
	},
	{
		id: "duplicate-import",
		rules: ["ai-slop/duplicate-import", "import/no-duplicates", "eslint/no-duplicate-imports"],
	},
	{
		id: "unreachable-code",
		rules: ["ai-slop/unreachable-code", "eslint/no-unreachable"],
	},
	{
		id: "empty-function",
		rules: ["ai-slop/empty-function", "eslint/no-empty-function"],
	},
];

const RULE_TO_GROUP = new Map<string, string>();
for (const group of EQUIVALENCE_GROUPS) {
	for (const rule of group.rules) {
		RULE_TO_GROUP.set(rule, group.id);
	}
}

const SEVERITY_RANK: Record<Severity, number> = {
	error: 3,
	warning: 2,
	info: 1,
};

const isNativeRaigalRule = (rule: string): boolean =>
	rule.startsWith("ai-slop/") ||
	rule.startsWith("security/") ||
	rule.startsWith("architecture/") ||
	rule.startsWith("code-quality/") ||
	rule.startsWith("complexity/");

const compareEquivalence = (a: Diagnostic, b: Diagnostic): number => {
	const sevA = SEVERITY_RANK[a.severity] ?? 0;
	const sevB = SEVERITY_RANK[b.severity] ?? 0;
	if (sevA !== sevB) {
		return sevB - sevA;
	}
	const nativeA = isNativeRaigalRule(a.rule);
	const nativeB = isNativeRaigalRule(b.rule);
	if (nativeA !== nativeB) {
		return nativeA ? -1 : 1;
	}
	return 0;
};

const normalizePath = (p: string): string => p.replace(/\\/g, "/");

export const dedupeEquivalenceDiagnostics = (results: EngineResult[]): EngineResult[] => {
	const locationGroupMap = new Map<string, Diagnostic[]>();

	for (const result of results) {
		for (const d of result.diagnostics) {
			if (!d.line || d.line <= 0) continue;
			const groupId = RULE_TO_GROUP.get(d.rule);
			if (!groupId) continue;

			const key = `${normalizePath(d.filePath)}:${d.line}:${groupId}`;
			const list = locationGroupMap.get(key) ?? [];
			list.push(d);
			locationGroupMap.set(key, list);
		}
	}

	const dropped = new Set<Diagnostic>();
	for (const diags of locationGroupMap.values()) {
		if (diags.length <= 1) continue;
		const sorted = [...diags].sort(compareEquivalence);
		for (let i = 1; i < sorted.length; i++) {
			dropped.add(sorted[i]);
		}
	}

	if (dropped.size === 0) return results;

	return results.map((result) => ({
		...result,
		diagnostics: result.diagnostics.filter((d) => !dropped.has(d)),
	}));
};
