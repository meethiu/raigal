import { z } from "zod/v4";

const DEFAULT_WEIGHTS: Record<string, number> = {
	format: 0.3,
	lint: 0.6,
	"code-quality": 0.8,
	"ai-slop": 1.0,
	architecture: 1.0,
	security: 1.5,
};

const EnginesSchema = z
	.object({
		format: z.boolean().default(true),
		lint: z.boolean().default(true),
		"code-quality": z.boolean().default(true),
		"ai-slop": z.boolean().default(true),
		architecture: z.boolean().default(false),
		security: z.boolean().default(true),
	})
	.strict();

const QualitySchema = z
	.object({
		maxFunctionLoc: z.number().positive().default(80),
		maxFileLoc: z.number().positive().default(400),
		maxNesting: z.number().positive().default(5),
		maxParams: z.number().positive().default(6),
	})
	.strict();

const CsharpLintSchema = z
	.object({
		projectEvaluation: z.boolean().default(false),
		jb: z.boolean().default(true),
		roslynator: z.boolean().default(true),
		jbSeverityFloor: z.enum(["ERROR", "WARNING", "SUGGESTION", "HINT"]).default("WARNING"),
		jbExcludeTypes: z.array(z.string()).default(() => ["InconsistentNaming"]),
		jbProjects: z.string().optional(),
	})
	.strict();

const CppLintSchema = z
	.object({
		cppcheck: z.boolean().default(true),
		clangTidy: z.boolean().default(true),
		cppcheckEnable: z.string().default("warning,performance,portability"),
		jb: z.boolean().default(false),
		jbProjects: z.string().optional(),
		jbSeverityFloor: z.enum(["ERROR", "WARNING", "SUGGESTION", "HINT"]).default("WARNING"),
		jbExcludeTypes: z.array(z.string()).default(() => []),
	})
	.strict();

const LintConfigSchema = z
	.object({
		typecheck: z.boolean().default(false),
		expoDoctor: z.boolean().default(false),
		csharp: CsharpLintSchema.default(() => ({
			projectEvaluation: false,
			jb: true,
			roslynator: true,
			jbSeverityFloor: "WARNING" as const,
			jbExcludeTypes: ["InconsistentNaming"],
		})),
		cpp: CppLintSchema.default(() => ({
			cppcheck: true,
			clangTidy: true,
			cppcheckEnable: "warning,performance,portability",
			jb: false,
			jbSeverityFloor: "WARNING" as const,
			jbExcludeTypes: [],
		})),
	})
	.strict();

const SecurityConfigSchema = z
	.object({
		audit: z.boolean().default(true),
		auditTimeout: z.number().positive().default(25000),
	})
	.strict();

const ThresholdsSchema = z
	.object({
		good: z.number().default(75),
		ok: z.number().default(50),
	})
	.strict();

const ScoringSchema = z
	.object({
		weights: z.record(z.string(), z.number()).default(DEFAULT_WEIGHTS),
		thresholds: ThresholdsSchema.default(() => ({
			good: 75,
			ok: 50,
		})),
		smoothing: z.number().nonnegative().default(5),
		maxPerRule: z.number().positive().default(40),
	})
	.strict();

const CiSchema = z
	.object({
		failBelow: z.number().default(70),
		format: z.enum(["json"]).default("json"),
	})
	.strict();

const TelemetrySchema = z
	.object({
		enabled: z.boolean().default(true),
	})
	.strict();

const RuleSeverityOverride = z.enum(["error", "warning", "off"]);

const RulesSchema = z.record(z.string(), RuleSeverityOverride).default(() => ({}));

const AislopConfigSchema = z
	.object({
		version: z.number().default(1),
		extends: z.union([z.string(), z.array(z.string())]).optional(),
		engines: EnginesSchema.default(() => ({
			format: true,
			lint: true,
			"code-quality": true,
			"ai-slop": true,
			architecture: false,
			security: true,
		})),
		quality: QualitySchema.default(() => ({
			maxFunctionLoc: 80,
			maxFileLoc: 400,
			maxNesting: 5,
			maxParams: 6,
		})),
		lint: LintConfigSchema.default(() => ({
			typecheck: false,
			expoDoctor: false,
			csharp: {
				projectEvaluation: false,
				jb: true,
				roslynator: true,
				jbSeverityFloor: "WARNING" as const,
				jbExcludeTypes: ["InconsistentNaming"],
			},
			cpp: {
				cppcheck: true,
				clangTidy: true,
				cppcheckEnable: "warning,performance,portability",
				jb: false,
				jbSeverityFloor: "WARNING" as const,
				jbExcludeTypes: [],
			},
		})),
		security: SecurityConfigSchema.default(() => ({
			audit: true,
			auditTimeout: 25000,
		})),
		scoring: ScoringSchema.default(() => ({
			weights: { ...DEFAULT_WEIGHTS },
			thresholds: {
				good: 75,
				ok: 50,
			},
			smoothing: 5,
			maxPerRule: 40,
		})),
		ci: CiSchema.default(() => ({
			failBelow: 70,
			format: "json" as const,
		})),
		telemetry: TelemetrySchema.default(() => ({
			enabled: true,
		})),
		rules: RulesSchema,
		exclude: z
			.array(z.string())
			.default(() => ["node_modules", ".git", "dist", "build", "coverage"]),
		include: z.array(z.string()).default(() => []),
	})
	.strict();

export type RuleSeverity = z.infer<typeof RuleSeverityOverride>;

export const RaigalConfigSchema = AislopConfigSchema;
export { AislopConfigSchema };

export type RaigalConfig = z.infer<typeof RaigalConfigSchema>;
export type AislopConfig = RaigalConfig;

const defaults: RaigalConfig = RaigalConfigSchema.parse({});

const preMergeWeights = (raw: Record<string, unknown>): void => {
	const scoring = raw.scoring as Record<string, unknown> | undefined;
	if (!scoring) return;

	const userWeights = scoring.weights as Record<string, number> | undefined;
	if (!userWeights || typeof userWeights !== "object") return;

	scoring.weights = { ...DEFAULT_WEIGHTS, ...userWeights };
};

const KNOWN_KEYS_BY_PATH: Record<string, string[]> = {
	"": [
		"version",
		"extends",
		"engines",
		"quality",
		"lint",
		"security",
		"scoring",
		"ci",
		"telemetry",
		"rules",
		"exclude",
		"include",
	],
	engines: ["format", "lint", "code-quality", "ai-slop", "architecture", "security"],
	quality: ["maxFunctionLoc", "maxFileLoc", "maxNesting", "maxParams"],
	lint: ["typecheck", "expoDoctor", "csharp", "cpp"],
	"lint.csharp": [
		"projectEvaluation",
		"jb",
		"roslynator",
		"jbSeverityFloor",
		"jbExcludeTypes",
		"jbProjects",
	],
	"lint.cpp": [
		"cppcheck",
		"clangTidy",
		"cppcheckEnable",
		"jb",
		"jbProjects",
		"jbSeverityFloor",
		"jbExcludeTypes",
	],
	security: ["audit", "auditTimeout"],
	scoring: ["weights", "thresholds", "smoothing", "maxPerRule"],
	"scoring.thresholds": ["good", "ok"],
	ci: ["failBelow", "format"],
	telemetry: ["enabled"],
};

const levenshtein = (a: string, b: string): number => {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = [];
	for (let i = 0; i <= m; i++) dp[i] = [i];
	for (let j = 0; j <= n; j++) dp[0][j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
			dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
		}
	}
	return dp[m][n];
};

const findClosestKey = (key: string, candidates: string[]): string | null => {
	const lowerKey = key.toLowerCase();
	if (lowerKey.includes("func")) {
		const funcMatch = candidates.find((c) => c.toLowerCase().includes("function"));
		if (funcMatch) return funcMatch;
	}
	let best: string | null = null;
	let minDistance = Infinity;
	for (const candidate of candidates) {
		const lowerCandidate = candidate.toLowerCase();
		if (lowerCandidate === lowerKey) return candidate;
		if (lowerCandidate.includes(lowerKey) || lowerKey.includes(lowerCandidate)) {
			return candidate;
		}
		const dist = levenshtein(key, candidate);
		if (dist < minDistance) {
			minDistance = dist;
			best = candidate;
		}
	}
	if (minDistance <= Math.max(3, Math.floor(key.length * 0.6))) {
		return best;
	}
	return null;
};

const formatConfigError = (filePath: string, issues: string[]): string => {
	return `Invalid configuration in ${filePath}:\n${issues.map((i) => `  - ${i}`).join("\n")}`;
};

export class ConfigError extends Error {
	readonly filePath: string;
	readonly issues: string[];

	constructor(filePath: string, issues: string[] | string) {
		const issueList = Array.isArray(issues) ? issues : [issues];
		super(formatConfigError(filePath, issueList));
		this.name = "ConfigError";
		this.filePath = filePath;
		this.issues = issueList;
	}
}

export const validateConfig = (raw: unknown, filePath: string): AislopConfig => {
	if (!raw || typeof raw !== "object") {
		throw new ConfigError(filePath, ["Configuration must be an object"]);
	}
	const input = raw as Record<string, unknown>;
	preMergeWeights(input);
	const result = AislopConfigSchema.safeParse(input);
	if (!result.success) {
		const formattedIssues: string[] = [];
		for (const issue of result.error.issues) {
			if (issue.code === "unrecognized_keys") {
				const pathStr = issue.path.join(".");
				const candidates = KNOWN_KEYS_BY_PATH[pathStr] ?? [];
				for (const k of issue.keys) {
					const fullKey = pathStr ? `${pathStr}.${k}` : k;
					const suggestion = findClosestKey(k, candidates);
					if (suggestion) {
						const suggestedFullKey = pathStr ? `${pathStr}.${suggestion}` : suggestion;
						formattedIssues.push(`Unknown key "${fullKey}". Did you mean "${suggestedFullKey}"?`);
					} else {
						formattedIssues.push(`Unknown key "${fullKey}".`);
					}
				}
			} else {
				const fullKey = issue.path.join(".");
				formattedIssues.push(`Invalid value for "${fullKey}": ${issue.message}`);
			}
		}
		throw new ConfigError(filePath, formattedIssues);
	}
	return result.data;
};

export const parseConfig = (raw: unknown): AislopConfig => {
	if (!raw || typeof raw !== "object") return defaults;

	try {
		const input = raw as Record<string, unknown>;
		preMergeWeights(input);
		return AislopConfigSchema.parse(input);
	} catch {
		return defaults;
	}
};
