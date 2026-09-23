import fs from "node:fs";
import path from "node:path";
import { ApiError, requestApi } from "./client.js";
import { Run } from "./contract.js";
import { getOutboxPath } from "./paths.js";
import type { RunType } from "./types.js";

export const MAX_OUTBOX_BYTES = 5 * 1024 * 1024; // 5 MB

const getMaxOutboxBytes = (): number => {
	const override = process.env.RAIGAL_MAX_OUTBOX_BYTES;
	if (override) {
		const parsed = Number.parseInt(override, 10);
		if (!Number.isNaN(parsed) && parsed > 0) return parsed;
	}
	return MAX_OUTBOX_BYTES;
};

export const loadOutboxRuns = (): RunType[] => {
	const outboxPath = getOutboxPath();
	if (!fs.existsSync(outboxPath)) return [];

	try {
		const content = fs.readFileSync(outboxPath, "utf-8");
		const lines = content.split("\n").filter((l) => l.trim().length > 0);
		const runs: RunType[] = [];

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);
				const valid = Run.safeParse(parsed);
				if (valid.success) {
					runs.push(valid.data);
				}
			} catch {
				// skip corrupted line
			}
		}

		return runs;
	} catch {
		return [];
	}
};

const writeRunsToOutbox = (runs: RunType[]): void => {
	const outboxPath = getOutboxPath();
	const dir = path.dirname(outboxPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	let lines = runs.map((r) => JSON.stringify(r));
	let text = lines.length > 0 ? `${lines.join("\n")}\n` : "";

	const maxBytes = getMaxOutboxBytes();
	// Enforce hard cap (drop oldest)
	while (Buffer.byteLength(text, "utf-8") > maxBytes && lines.length > 1) {
		lines.shift();
		text = `${lines.join("\n")}\n`;
	}

	const temp = `${outboxPath}.${Date.now()}.tmp`;
	fs.writeFileSync(temp, text, { mode: 0o600 });
	try {
		fs.renameSync(temp, outboxPath);
	} catch {
		fs.rmSync(temp, { force: true });
		fs.writeFileSync(outboxPath, text, { mode: 0o600 });
	}
};

export const enqueueRun = (run: RunType): void => {
	const existing = loadOutboxRuns();
	existing.push(run);
	writeRunsToOutbox(existing);
};

export const getLastRecordedRun = (): RunType | null => {
	const runs = loadOutboxRuns();
	return runs.length > 0 ? (runs[runs.length - 1] ?? null) : null;
};

export const clearOutbox = (): void => {
	const outboxPath = getOutboxPath();
	if (fs.existsSync(outboxPath)) {
		try {
			fs.rmSync(outboxPath, { force: true });
		} catch {
			/* best effort */
		}
	}
};

export interface FlushResult {
	sent: number;
	failed: number;
	remaining: number;
}

export const flushOutbox = async (token: string): Promise<FlushResult> => {
	const runs = loadOutboxRuns();
	if (runs.length === 0) {
		return { sent: 0, failed: 0, remaining: 0 };
	}

	let sentCount = 0;
	let failCount = 0;
	const remainingRuns: RunType[] = [];

	for (let i = 0; i < runs.length; i++) {
		const run = runs[i]!;
		try {
			await requestApi("/v1/runs", {
				method: "POST",
				token,
				body: run,
				timeoutMs: 4000,
			});
			sentCount++;
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				// Permanent rejection: 400, 401, 403, 413, 422 - drop to avoid head-of-line blocking
				if ([400, 401, 403, 413, 422].includes(err.status)) {
					failCount++;
					continue;
				}
				// 409 Conflict: already uploaded (idempotency key match) - consider sent
				if (err.status === 409) {
					sentCount++;
					continue;
				}
			}

			// Network error or server 5xx: keep this run and all subsequent runs for next time
			failCount++;
			remainingRuns.push(...runs.slice(i));
			break;
		}
	}

	writeRunsToOutbox(remainingRuns);

	return {
		sent: sentCount,
		failed: failCount,
		remaining: remainingRuns.length,
	};
};
