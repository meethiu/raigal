import { getLastRecordedRun, loadOutboxRuns } from "../cloud/outbox.js";
import { log } from "../ui/logger.js";

export interface TelemetryShowOptions {
	json?: boolean;
}

export const telemetryShowCommand = async (options: TelemetryShowOptions = {}): Promise<void> => {
	const lastRun = getLastRecordedRun();
	const outbox = loadOutboxRuns();

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					last_run: lastRun,
					pending_outbox_count: outbox.length,
				},
				null,
				2,
			),
		);
		return;
	}

	process.stdout.write("\n");
	process.stdout.write("  Raigal Cloud Telemetry & Outbox Status\n");
	process.stdout.write("  ─────────────────────────────────────\n\n");

	if (!lastRun) {
		log.info("No recorded runs found in local outbox.");
		process.stdout.write(`  Pending outbox runs: 0\n\n`);
		return;
	}

	process.stdout.write(`  Last Run ID:        ${lastRun.run_id}\n`);
	process.stdout.write(`  Command:            ${lastRun.command}\n`);
	process.stdout.write(`  Repository:         ${lastRun.repo.slug} (${lastRun.repo.provider})\n`);
	process.stdout.write(`  Branch:             ${lastRun.git.branch ?? "none"}\n`);
	process.stdout.write(`  Head SHA:           ${lastRun.git.head_sha ?? "none"}\n`);
	if (lastRun.git.pr_number !== undefined) {
		process.stdout.write(`  Pull Request:       #${lastRun.git.pr_number}\n`);
	}
	process.stdout.write(`  Started:            ${lastRun.started_at}\n`);
	process.stdout.write(`  Ended:              ${lastRun.ended_at}\n`);
	process.stdout.write(`  Exit Code:          ${lastRun.exit_code}\n`);
	process.stdout.write(
		`  Flags:              ${lastRun.flags.length > 0 ? lastRun.flags.join(", ") : "none"}\n`,
	);
	process.stdout.write(`  Steps:              ${lastRun.steps.length} step(s) recorded\n`);

	if (lastRun.report) {
		process.stdout.write(`  Files Scanned:      ${lastRun.report.files_scanned}\n`);
		process.stdout.write(
			`  Score:              ${lastRun.report.score !== null ? `${lastRun.report.score}/100` : "withheld"}\n`,
		);
		process.stdout.write(
			`  Findings Transmitted: ${lastRun.report.findings.length} (fingerprints only, no source code)\n`,
		);
	}

	process.stdout.write(`\n  Pending outbox runs: ${outbox.length}\n`);
	process.stdout.write(
		"  Privacy guarantee: No source code or secret values are ever included.\n\n",
	);
};
