import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Diagnostic } from "../engines/types.js";
import type { RailStep } from "../ui/rail.js";
import {
	areLiteralMultisetsEqual,
	extractStringAndTemplateLiterals,
} from "../utils/source-masker.js";

export interface FixStepResult {
	name: string;
	beforeIssues: number;
	afterIssues: number;
	resolvedIssues: number;
	beforeFiles: number;
	failed: boolean;
	elapsedMs: number;
	afterDiagnostics?: Diagnostic[];
}

const uniqueFileCount = (diagnostics: Diagnostic[]): number =>
	new Set(diagnostics.map((d) => d.filePath)).size;

export interface RunFixStepOptions {
	dryRun?: boolean;
}

export const runOneFixStep = async (
	name: string,
	detect: () => Promise<Diagnostic[]>,
	applyFix: () => Promise<void>,
	options: RunFixStepOptions = {},
): Promise<FixStepResult> => {
	const started = performance.now();
	const before = await detect();
	if (options.dryRun) {
		return {
			name,
			beforeIssues: before.length,
			afterIssues: before.length,
			resolvedIssues: 0,
			beforeFiles: uniqueFileCount(before),
			failed: false,
			elapsedMs: performance.now() - started,
			afterDiagnostics: before,
		};
	}
	let applyError: unknown = null;
	if (before.length > 0) {
		const filesToWatch = new Map<string, { content: string; literals: string[]; ext: string }>();
		for (const d of before) {
			const filePath = d.filePath;
			if (!filesToWatch.has(filePath)) {
				try {
					const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
					if (fs.existsSync(abs)) {
						const content = fs.readFileSync(abs, "utf-8");
						const ext = path.extname(abs);
						filesToWatch.set(abs, {
							content,
							literals: extractStringAndTemplateLiterals(content, ext),
							ext,
						});
					}
				} catch {
					// Ignore
				}
			}
		}

		try {
			await applyFix();
		} catch (error) {
			applyError = error;
		}

		for (const [abs, snap] of filesToWatch) {
			try {
				if (fs.existsSync(abs)) {
					const currentContent = fs.readFileSync(abs, "utf-8");
					if (currentContent !== snap.content) {
						const currentLiterals = extractStringAndTemplateLiterals(currentContent, snap.ext);
						if (!areLiteralMultisetsEqual(snap.literals, currentLiterals)) {
							fs.writeFileSync(abs, snap.content);
						}
					}
				}
			} catch {
				// Ignore
			}
		}
	}
	const after = before.length > 0 ? await detect() : before;
	return {
		name,
		beforeIssues: before.length,
		afterIssues: after.length,
		resolvedIssues: Math.max(0, before.length - after.length),
		beforeFiles: uniqueFileCount(before),
		failed: applyError !== null && before.length === after.length,
		elapsedMs: performance.now() - started,
		afterDiagnostics: after,
	};
};

export const describeStep = (result: FixStepResult): string => {
	if (result.failed) {
		return `${result.name} - failed (${result.afterIssues} remain)`;
	}
	if (result.beforeIssues === 0) {
		return `${result.name} - 0 issues`;
	}
	if (result.afterIssues === 0) {
		return `${result.name} - ${result.resolvedIssues} resolved`;
	}
	if (result.resolvedIssues > 0) {
		return `${result.name} - ${result.resolvedIssues} resolved, ${result.afterIssues} remaining`;
	}
	return `${result.name} - ${result.afterIssues} remain`;
};

export const statusFor = (s: FixStepResult): RailStep["status"] => {
	if (s.failed) return "failed";
	if (s.afterIssues > 0) return "warn";
	return "done";
};

const findingLabel = (count: number): string => (count === 1 ? "finding" : "findings");
const fileLabel = (count: number): string => (count === 1 ? "file" : "files");

export const describePreviewStep = (result: FixStepResult): string => {
	if (result.beforeIssues === 0) {
		return `${result.name} - 0 findings`;
	}
	return `${result.name} - ${result.beforeIssues} ${findingLabel(result.beforeIssues)} in ${result.beforeFiles} ${fileLabel(result.beforeFiles)}`;
};

export const describeSkippedStep = (name: string, reason: string): string => `${name} - ${reason}`;
