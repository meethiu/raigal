import { randomUUID } from "node:crypto";
import { APP_VERSION } from "../version.js";
import { detectCiContext, detectGitContext, detectRepoRef } from "./context.js";
import { getActiveToken } from "./credentials.js";
import { enqueueRun, flushOutbox } from "./outbox.js";
import type { ReportType, RunType, StepType } from "./types.js";

export class CloudRunRecorder {
	public readonly runId: string;
	public readonly command: "scan" | "ci" | "fix" | "agent" | "hook";
	public readonly directory: string;
	public readonly flags: string[];
	public readonly startedAt: string;

	private steps: StepType[] = [];
	private report?: ReportType;
	private policyMeta?: { version: number; hash: string };
	private seq = 0;
	private finished = false;

	constructor(
		command: "scan" | "ci" | "fix" | "agent" | "hook",
		directory: string,
		flags: string[] = [],
	) {
		this.runId = randomUUID();
		this.command = command;
		this.directory = directory;
		// Keep only flag names, never values, max 40
		this.flags = flags
			.map((f) => f.replace(/^--?/, ""))
			.filter((f) => f.length > 0)
			.slice(0, 40);
		this.startedAt = new Date().toISOString();
	}

	public recordStep(
		name: string,
		durationMs: number,
		ok = true,
		counts?: Record<string, number>,
	): void {
		if (this.steps.length >= 200) return;
		this.steps.push({
			seq: this.seq++,
			name: name.slice(0, 80),
			ok,
			ms: Math.max(0, Math.round(durationMs)),
			counts,
		});
	}

	public setReport(report: ReportType): void {
		this.report = report;
	}

	public setPolicyMeta(version: number, hash: string): void {
		this.policyMeta = { version, hash: hash.slice(0, 64) };
	}

	public buildRunPayload(exitCode: number): RunType {
		const repo = detectRepoRef(this.directory) || {
			provider: "github" as const,
			slug: "unknown/unknown",
		};

		const git = detectGitContext(this.directory);
		const ci = detectCiContext();
		const ownerVerified = Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);

		return {
			run_id: this.runId,
			command: this.command,
			repo,
			owner_verified: ownerVerified,
			git,
			ci,
			flags: this.flags,
			cli_version: APP_VERSION,
			policy: this.policyMeta,
			started_at: this.startedAt,
			ended_at: new Date().toISOString(),
			exit_code: exitCode,
			steps: this.steps.slice(0, 200),
			report: this.report,
		};
	}

	public async finish(exitCode: number): Promise<void> {
		if (this.finished) return;
		this.finished = true;

		try {
			const run = this.buildRunPayload(exitCode);
			enqueueRun(run);

			const activeToken = getActiveToken();
			if (activeToken) {
				await flushOutbox(activeToken.token);
			}
		} catch {
			// Outbox and recorder failures are non-fatal to the CLI
		}
	}
}

let activeRecorder: CloudRunRecorder | null = null;

export const getActiveRecorder = (): CloudRunRecorder | null => activeRecorder;

export const startRunRecorder = (
	command: "scan" | "ci" | "fix" | "agent" | "hook",
	directory: string,
	flags: string[] = [],
): CloudRunRecorder => {
	const recorder = new CloudRunRecorder(command, directory, flags);
	activeRecorder = recorder;

	// Flush existing spooled outbox runs at run start (best effort, unblocked)
	const activeToken = getActiveToken();
	if (activeToken) {
		void flushOutbox(activeToken.token).catch(() => {
			/* best effort */
		});
	}

	return recorder;
};

export const finishActiveRecorder = async (exitCode = 0): Promise<void> => {
	if (activeRecorder) {
		const rec = activeRecorder;
		activeRecorder = null;
		await rec.finish(exitCode);
	}
};
