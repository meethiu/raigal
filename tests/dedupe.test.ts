import { describe, expect, it } from "vitest";
import { createOxlintConfig } from "../src/engines/lint/oxlint-config.js";
import {
	dedupeEquivalenceDiagnostics,
	EQUIVALENCE_GROUPS,
} from "../src/engines/equivalence-dedupe.js";
import type { Diagnostic, EngineName, EngineResult } from "../src/engines/types.js";
import { calculateScore } from "../src/scoring/index.js";

const mk = (
	engine: EngineName,
	rule: string,
	filePath: string,
	line: number,
	severity: "error" | "warning" | "info" = "warning",
	message = "finding message",
): Diagnostic => ({
	filePath,
	engine,
	rule,
	severity,
	message,
	help: "fix it",
	line,
	column: 1,
	category: engine === "security" ? "Security" : engine === "ai-slop" ? "AI Slop" : "Lint",
	fixable: false,
});

const wrapResult = (engine: EngineName, diagnostics: Diagnostic[]): EngineResult => ({
	engine,
	diagnostics,
	elapsed: 0,
	skipped: false,
});

describe("Task 2: Duplicate findings and equivalence deduplication", () => {
	describe("Config layer", () => {
		it("turns off no-eval in oxlint when security engine is enabled", () => {
			const configWithSecurity = createOxlintConfig({ securityEnabled: true });
			const rules = configWithSecurity.rules as Record<string, string>;
			expect(rules["no-eval"]).toBe("off");
		});

		it("does not turn off no-eval in oxlint when security engine is disabled", () => {
			const configWithoutSecurity = createOxlintConfig({ securityEnabled: false });
			const rules = configWithoutSecurity.rules as Record<string, string>;
			expect(rules["no-eval"]).toBeUndefined();
		});
	});

	describe("Dedupe layer", () => {
		it("one eval(q) produces exactly one finding (severity error)", () => {
			const results: EngineResult[] = [
				wrapResult("lint", [mk("lint", "eslint/no-eval", "src/danger.ts", 5, "warning")]),
				wrapResult("security", [mk("security", "security/eval", "src/danger.ts", 5, "error")]),
			];

			const deduped = dedupeEquivalenceDiagnostics(results);
			const allDiagnostics = deduped.flatMap((r) => r.diagnostics);

			expect(allDiagnostics).toHaveLength(1);
			expect(allDiagnostics[0].rule).toBe("security/eval");
			expect(allDiagnostics[0].severity).toBe("error");
		});

		it("one unused import produces one finding (keeping native Raigal rule on tie)", () => {
			const results: EngineResult[] = [
				wrapResult("lint", [
					mk("lint", "eslint/no-unused-vars", "src/slop.ts", 2, "warning"),
				]),
				wrapResult("ai-slop", [
					mk("ai-slop", "ai-slop/unused-import", "src/slop.ts", 2, "warning"),
				]),
			];

			const deduped = dedupeEquivalenceDiagnostics(results);
			const allDiagnostics = deduped.flatMap((r) => r.diagnostics);

			expect(allDiagnostics).toHaveLength(1);
			expect(allDiagnostics[0].rule).toBe("ai-slop/unused-import");
			expect(allDiagnostics[0].severity).toBe("warning");
		});

		it("a non-import unused variable is not deduplicated", () => {
			const results: EngineResult[] = [
				wrapResult("lint", [
					mk("lint", "eslint/no-unused-vars", "src/slop.ts", 10, "warning"),
				]),
				wrapResult("ai-slop", []),
			];

			const deduped = dedupeEquivalenceDiagnostics(results);
			const allDiagnostics = deduped.flatMap((r) => r.diagnostics);

			expect(allDiagnostics).toHaveLength(1);
			expect(allDiagnostics[0].rule).toBe("eslint/no-unused-vars");
		});

		it("two unrelated rules on the same line both remain", () => {
			const results: EngineResult[] = [
				wrapResult("lint", [
					mk("lint", "eslint/no-unused-vars", "src/file.ts", 8, "warning"),
				]),
				wrapResult("security", [
					mk("security", "security/hardcoded-secret", "src/file.ts", 8, "error"),
				]),
			];

			const deduped = dedupeEquivalenceDiagnostics(results);
			const allDiagnostics = deduped.flatMap((r) => r.diagnostics);

			expect(allDiagnostics).toHaveLength(2);
			expect(allDiagnostics.map((d) => d.rule)).toEqual(
				expect.arrayContaining(["eslint/no-unused-vars", "security/hardcoded-secret"]),
			);
		});

		it("output order is deterministic", () => {
			const makeInput = () => [
				wrapResult("lint", [
					mk("lint", "eslint/no-unused-vars", "src/a.ts", 2, "warning"),
					mk("lint", "eslint/no-eval", "src/b.ts", 5, "warning"),
				]),
				wrapResult("ai-slop", [
					mk("ai-slop", "ai-slop/unused-import", "src/a.ts", 2, "warning"),
				]),
				wrapResult("security", [
					mk("security", "security/eval", "src/b.ts", 5, "error"),
				]),
			];

			const runs = Array.from({ length: 5 }, () => {
				const deduped = dedupeEquivalenceDiagnostics(makeInput());
				return deduped.map((r) => ({
					engine: r.engine,
					rules: r.diagnostics.map((d) => d.rule),
				}));
			});

			for (let i = 1; i < runs.length; i++) {
				expect(runs[i]).toEqual(runs[0]);
			}
		});

		it("the score for the deduplicated case is higher than before and identical across runs", () => {
			const unDedupedDiagnostics = [
				mk("lint", "eslint/no-eval", "src/danger.ts", 5, "warning"),
				mk("security", "security/eval", "src/danger.ts", 5, "error"),
				mk("lint", "eslint/no-unused-vars", "src/slop.ts", 2, "warning"),
				mk("ai-slop", "ai-slop/unused-import", "src/slop.ts", 2, "warning"),
			];

			const results: EngineResult[] = [
				wrapResult("lint", [
					mk("lint", "eslint/no-eval", "src/danger.ts", 5, "warning"),
					mk("lint", "eslint/no-unused-vars", "src/slop.ts", 2, "warning"),
				]),
				wrapResult("ai-slop", [
					mk("ai-slop", "ai-slop/unused-import", "src/slop.ts", 2, "warning"),
				]),
				wrapResult("security", [
					mk("security", "security/eval", "src/danger.ts", 5, "error"),
				]),
			];

			const weights = {
				format: 0.3,
				lint: 0.6,
				"code-quality": 0.8,
				"ai-slop": 1.0,
				architecture: 1.0,
				security: 1.5,
			};
			const thresholds = { good: 75, ok: 50 };

			const unDedupedScore = calculateScore(
				unDedupedDiagnostics,
				weights,
				thresholds,
				2,
			).score;

			const dedupedResults = dedupeEquivalenceDiagnostics(results);
			const dedupedDiagnostics = dedupedResults.flatMap((r) => r.diagnostics);

			const dedupedScore = calculateScore(
				dedupedDiagnostics,
				weights,
				thresholds,
				2,
			).score;

			expect(dedupedScore).toBeGreaterThan(unDedupedScore);

			// Identical across runs
			for (let i = 0; i < 5; i++) {
				const runScore = calculateScore(
					dedupeEquivalenceDiagnostics(results).flatMap((r) => r.diagnostics),
					weights,
					thresholds,
					2,
				).score;
				expect(runScore).toBe(dedupedScore);
			}
		});

		it("constant-condition and swallowed-exception are also deduplicated", () => {
			const results: EngineResult[] = [
				wrapResult("lint", [
					mk("lint", "eslint/no-constant-condition", "src/test.ts", 10, "warning"),
					mk("lint", "eslint/no-empty", "src/test.ts", 20, "warning"),
				]),
				wrapResult("ai-slop", [
					mk("ai-slop", "ai-slop/constant-condition", "src/test.ts", 10, "warning"),
					mk("ai-slop", "ai-slop/swallowed-exception", "src/test.ts", 20, "error"),
				]),
			];

			const deduped = dedupeEquivalenceDiagnostics(results);
			const allDiagnostics = deduped.flatMap((r) => r.diagnostics);

			expect(allDiagnostics).toHaveLength(2);
			// constant-condition: both warning, native ai-slop wins
			expect(allDiagnostics.find((d) => d.line === 10)?.rule).toBe(
				"ai-slop/constant-condition",
			);
			// swallowed-exception vs no-empty: error wins over warning
			expect(allDiagnostics.find((d) => d.line === 20)?.rule).toBe(
				"ai-slop/swallowed-exception",
			);
		});
	});
});
