import path from "node:path";
import { performance } from "node:perf_hooks";
import { type AislopConfig, findConfigDir, RULES_FILE } from "../config/index.js";
import { recordFullScanActivity } from "../engagement/full-scan-activity.js";
import type { Diagnostic, EngineConfig, EngineResult } from "../engines/types.js";
import { renderDiagnostics } from "../output/terminal.js";
import { calculateScore } from "../scoring/index.js";
import { applyRuleSeverities } from "../scoring/rule-severity.js";
import { isCiEnv } from "../telemetry/env.js";
import { type EngineCounts, withCommandLifecycle } from "../telemetry/index.js";
import { renderDisplayRows } from "../ui/display.js";
import { renderHeader } from "../ui/header.js";
import { log } from "../ui/logger.js";
import { applyChangeContext } from "../utils/change-context.js";
import { detectSourceLanguages, discoverProject, type Language } from "../utils/discover.js";
import { getChangedLineMap } from "../utils/git.js";
import { readAislopIgnorePatterns } from "../utils/source-files.js";
import { applySuppressions } from "../utils/suppress.js";
import { APP_VERSION } from "../version.js";
import { renderCoverageNotice } from "./scan-coverage.js";
import { runEnginesWithProgress } from "./scan-engine-runner.js";
import { computeScanExitCode } from "./scan-exit-code.js";
import { collectScanFileScope, deriveScanCoverage } from "./scan-file-scope.js";
import {
	isFullProjectScan,
	isHistoryComparableScan,
	isMachineOutput,
	resolveScanScopeMode,
	type ScanOptions,
} from "./scan-options.js";
import { buildScanRender } from "./scan-render.js";
import { requireEntitlement } from "../cloud/gate.js";
import { scanTargetError } from "./scan-validation.js";
import { getActiveToken } from "../cloud/credentials.js";
import { detectRepoRef } from "../cloud/context.js";
import { toContractFinding } from "../cloud/fingerprint.js";
import { applyPolicyToConfig, fetchRemotePolicy } from "../cloud/policy.js";
import { getActiveRecorder } from "../cloud/recorder.js";

export { buildScanRender } from "./scan-render.js";

const renderScopeRow = (value: string): string =>
	`${renderDisplayRows([{ label: "Scope", value }], { indent: 1 }).join("\n")}\n`;

interface RecordScanParams {
	results: EngineResult[];
	allDiagnostics: Diagnostic[];
	resolvedDir: string;
	scoreable: boolean;
	score: number | null;
	totalFiles: number;
	config: AislopConfig;
	scoreFileCount: number;
}

const recordScanToCloud = (p: RecordScanParams): void => {
	const recorder = getActiveRecorder();
	if (!recorder) return;
	for (const r of p.results) {
		recorder.recordStep(`engine:${r.engine}`, r.elapsed, true, {
			findings: r.diagnostics.length,
		});
	}
	const engineScores: Record<string, number> = {};
	for (const r of p.results) {
		engineScores[r.engine] = calculateScore(
			r.diagnostics,
			p.config.scoring.weights,
			p.config.scoring.thresholds,
			p.scoreFileCount,
			p.config.scoring.smoothing,
			p.config.scoring.maxPerRule,
		).score;
	}
	const contractFindings = p.allDiagnostics.map((d) => toContractFinding(d, p.resolvedDir));
	recorder.setReport({
		score: p.scoreable ? p.score : null,
		scoreable: p.scoreable,
		engine_scores: engineScores,
		files_scanned: p.totalFiles,
		findings: contractFindings,
	});
};

export const scanCommand = async (
	directory: string,
	config: AislopConfig,
	options: ScanOptions,
): Promise<{ exitCode: number }> => {
	const resolvedDir = path.resolve(directory);
	await requireEntitlement({ directory: resolvedDir, mode: "fatal" });
	const targetError = scanTargetError(resolvedDir, options);
	if (targetError) {
		if (options.json) {
			console.log(JSON.stringify({ error: targetError }, null, 2));
		} else {
			log.error(targetError);
		}
		return { exitCode: 1 };
	}

	let activeConfig = config;
	const activeToken = getActiveToken();
	const repoRef = detectRepoRef(resolvedDir);
	if (activeToken && repoRef) {
		try {
			const remotePolicy = await fetchRemotePolicy(repoRef.slug, activeToken.token);
			if (remotePolicy) {
				const merged = applyPolicyToConfig(activeConfig, remotePolicy);
				activeConfig = merged.config;
				getActiveRecorder()?.setPolicyMeta(remotePolicy.version, remotePolicy.hash);
			}
		} catch {
			/* non-fatal policy fetch */
		}
	}

	const excludePatterns = [...activeConfig.exclude, ...readAislopIgnorePatterns(resolvedDir)];
	const scanScope = collectScanFileScope({
		excludePatterns,
		includePatterns: activeConfig.include,
		mode: resolveScanScopeMode(options),
		rootDirectory: resolvedDir,
	});
	const discoveredProject = await discoverProject(resolvedDir, excludePatterns, {
		includePatterns: activeConfig.include,
	});
	const projectInfo = {
		...discoveredProject,
		languages: detectSourceLanguages([...scanScope.files, ...scanScope.testFiles]),
	};

	return withCommandLifecycle(
		{
			command: options.command ?? "scan",
			config: activeConfig.telemetry,
			languages: projectInfo.languages,
			fileCount: scanScope.scoreFileCount,
		},
		() =>
			runScanBody(
				resolvedDir,
				activeConfig,
				options,
				projectInfo,
				scanScope,
				discoveredProject.languages,
			),
	);
};

const runScanBody = async (
	resolvedDir: string,
	config: AislopConfig,
	options: ScanOptions,
	projectInfo: Awaited<ReturnType<typeof discoverProject>>,
	scanScope: ReturnType<typeof collectScanFileScope>,
	dependencyAuditLanguages: Language[],
) => {
	const startTime = performance.now();
	const showHeader = options.showHeader !== false;
	const machineOutput = isMachineOutput(options);
	const projectName = projectInfo.projectName ?? "project";
	const language = projectInfo.languages[0] ?? "unknown";
	const printedHumanHeader = !machineOutput && showHeader;
	const {
		dependencyAuditFiles,
		dependencyAuditScope,
		files,
		projectFiles,
		scoreFileCount,
		scopeLabel,
		testFiles,
	} = scanScope;
	// Raw user excludes for the build-backed C# engines' diagnostic post-filter
	// (same derivation as the caller's scan-scope request).
	const excludePatterns = [...config.exclude, ...readAislopIgnorePatterns(resolvedDir)];
	const scanCoverage = deriveScanCoverage(projectInfo.coverage, scoreFileCount);
	const reportProjectInfo = {
		...projectInfo,
		coverage: scanCoverage,
		sourceFileCount: scoreFileCount,
	};

	if (printedHumanHeader) {
		process.stdout.write(
			renderHeader({
				version: APP_VERSION,
				command: "Scan result",
				context: [projectName, language, `${scoreFileCount} files`],
				brand: options.printBrand !== false,
			}),
		);
	}

	if (!machineOutput) {
		process.stdout.write(renderScopeRow(`${files.length + testFiles.length} ${scopeLabel}`));
	}

	const configDir = findConfigDir(resolvedDir);
	const rulesPath = configDir ? path.join(configDir, RULES_FILE) : undefined;

	const engineConfig: EngineConfig = {
		quality: config.quality,
		security: config.security,
		lint: config.lint,
		architectureRulesPath: config.engines.architecture ? rulesPath : undefined,
		engines: config.engines,
	};

	const rawResults = await runEnginesWithProgress(
		{
			rootDirectory: resolvedDir,
			languages: projectInfo.languages,
			frameworks: projectInfo.frameworks,
			dependencyAuditFiles,
			dependencyAuditLanguages,
			dependencyAuditScope,
			files,
			excludePatterns,
			testFiles,
			projectFiles,
			installedTools: projectInfo.installedTools,
			config: engineConfig,
		},
		config.engines,
		machineOutput,
	);

	const severityAdjusted = rawResults.map((result) => ({
		...result,
		diagnostics: applyRuleSeverities(result.diagnostics, config.rules),
	}));
	const { results: unannotated, suppressedCount } = applySuppressions(
		severityAdjusted,
		resolvedDir,
	);
	if (suppressedCount > 0 && !machineOutput) {
		log.muted(`Suppressed ${suppressedCount} finding(s) via raigal-ignore directives`);
	}

	const classifyChanges = options.changes && !options.staged;
	const changeMap = classifyChanges ? getChangedLineMap(resolvedDir, options.base) : null;
	const results = changeMap
		? unannotated.map((result) => ({
				...result,
				diagnostics: applyChangeContext(result.diagnostics, changeMap, resolvedDir),
			}))
		: unannotated;

	const allDiagnostics = results.flatMap((r) => r.diagnostics);
	const elapsedMs = performance.now() - startTime;

	const scoreResult = calculateScore(
		allDiagnostics,
		config.scoring.weights,
		config.scoring.thresholds,
		scoreFileCount,
		config.scoring.smoothing,
		config.scoring.maxPerRule,
	);
	const scoreable = scanCoverage.scoreable;
	const hasErrors = allDiagnostics.some((d) => d.severity === "error");
	const exitCode = computeScanExitCode({
		hasErrors,
		scoreable,
		score: scoreResult.score,
		failBelow: config.ci.failBelow,
	});

	const engineIssues: EngineCounts = {};
	const engineTimings: EngineCounts = {};
	for (const r of results) {
		engineIssues[r.engine] = r.diagnostics.length;
		engineTimings[r.engine] = Math.round(r.elapsed);
	}
	const completion = {
		exitCode,
		score: scoreable ? scoreResult.score : null,
		scoreable,
		findingCount: allDiagnostics.length,
		errorCount: allDiagnostics.filter((d) => d.severity === "error").length,
		warningCount: allDiagnostics.filter((d) => d.severity === "warning").length,
		fixableCount: allDiagnostics.filter((d) => d.fixable).length,
		engineIssues,
		engineTimings,
	};

	recordScanToCloud({
		results,
		allDiagnostics,
		resolvedDir,
		scoreable,
		score: scoreResult.score,
		totalFiles: files.length + testFiles.length,
		config,
		scoreFileCount,
	});

	if (options.sarif) {
		const { buildSarifLog } = await import("../output/sarif.js");
		console.log(JSON.stringify(buildSarifLog(results), null, 2));
		return completion;
	}

	if (options.json) {
		const { buildJsonOutput } = await import("../output/json.js");
		const jsonOut = buildJsonOutput(results, scoreResult, scoreFileCount, elapsedMs, scanCoverage);
		console.log(JSON.stringify(jsonOut, null, 2));
		return completion;
	}

	if (!scoreable) {
		if (!machineOutput) {
			process.stdout.write(
				renderCoverageNotice(reportProjectInfo, !printedHumanHeader && showHeader),
			);
			// Score is withheld, but findings still ran on the supported files; show them so a CI failure on an error diagnostic is explained.
			if (allDiagnostics.length > 0) {
				process.stdout.write(renderDiagnostics(allDiagnostics, options.verbose ?? false));
			}
		}
		return completion;
	}

	const isLocalHistoryScan = isHistoryComparableScan(options) && !isCiEnv();
	const showPilotInvitation = isLocalHistoryScan
		? recordFullScanActivity(
				{
					directory: resolvedDir,
					score: scoreResult.score,
					errors: completion.errorCount,
					warnings: completion.warningCount,
					files: scoreFileCount,
				},
				isFullProjectScan(options) && options.printBrand !== false,
				config.telemetry,
			)
		: false;

	process.stdout.write(
		buildScanRender({
			projectName,
			language,
			fileCount: scoreFileCount,
			results,
			diagnostics: allDiagnostics,
			score: scoreResult,
			elapsedMs,
			thresholds: config.scoring.thresholds,
			verbose: options.verbose,
			includeHeader: !printedHumanHeader && showHeader,
			printBrand: options.printBrand,
			showPilotInvitation,
		}),
	);

	return completion;
};
