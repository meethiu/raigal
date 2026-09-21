export type FailOnMode = "none" | "error" | "warning";

export interface ScanExitCodeOptions {
	hasErrors: boolean;
	hasWarnings?: boolean;
	failOn?: FailOnMode;
	scoreable?: boolean;
	score?: number;
	failBelow?: number;
	command?: "scan" | "ci";
}

/**
 * Scan exit code:
 * - When failOn is specified or in scan mode, scan exits 1 only on findings matching failOn.
 * - By default (failOn="error"), scan exits 1 only on error-severity findings.
 * - It never applies the score gate (that stays in CI).
 * - Legacy calls without failOn and with failBelow/score preserve the original CI gate logic.
 */
export const computeScanExitCode = (opts: ScanExitCodeOptions): number => {
	const failOn = opts.failOn ?? (opts.command === "scan" ? "error" : undefined);
	if (failOn) {
		if (failOn === "none") return 0;
		if (failOn === "warning") return opts.hasErrors || opts.hasWarnings ? 1 : 0;
		return opts.hasErrors ? 1 : 0;
	}

	// Legacy / CI semantics:
	return opts.hasErrors || (Boolean(opts.scoreable) && (opts.score ?? 0) < (opts.failBelow ?? 0))
		? 1
		: 0;
};

/**
 * CI exit code:
 * - Error diagnostics always fail CI.
 * - When scoreable, failing below the configured score threshold fails CI.
 */
export const computeCiExitCode = (opts: {
	hasErrors: boolean;
	scoreable: boolean;
	score: number;
	failBelow: number;
}): number => (opts.hasErrors || (opts.scoreable && opts.score < opts.failBelow) ? 1 : 0);
