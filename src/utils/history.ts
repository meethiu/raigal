import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "../config/index.js";
import { maskSecrets } from "./mask-secrets.js";
import { APP_VERSION } from "../version.js";

const HISTORY_FILE = "history.jsonl";

export interface HistoryRecord {
	timestamp: string;
	score: number;
	errors: number;
	warnings: number;
	files: number;
	cliVersion: string;
}

export const isHistoryDisabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
	env.AISLOP_NO_HISTORY === "1" || env.RAIGAL_NO_HISTORY === "1";

const resolveHistoryDir = (directory: string): string | null => {
	const resolved = path.resolve(directory);
	const primary = path.join(resolved, CONFIG_DIR);
	if (fs.existsSync(primary)) return primary;
	return null;
};

const historyPath = (directory: string): string | null => {
	const dir = resolveHistoryDir(directory);
	return dir ? path.join(dir, HISTORY_FILE) : null;
};

export interface AppendHistoryInput {
	directory: string;
	score: number;
	errors: number;
	warnings: number;
	files: number;
	[key: string]: unknown;
}

/**
 * Append a compact scan record to .raigal/history.jsonl (or .aislop/history.jsonl).
 * Best-effort: never throws, so a read-only checkout or missing config dir can't break a scan.
 */
export const appendHistory = (input: AppendHistoryInput): void => {
	if (isHistoryDisabled()) return;
	const file = historyPath(input.directory);
	if (!file) return;

	const record: HistoryRecord = {
		timestamp: new Date().toISOString(),
		score: input.score,
		errors: input.errors,
		warnings: input.warnings,
		files: input.files,
		cliVersion: APP_VERSION,
		...input,
	};
	try {
		const serialized = maskSecrets(JSON.stringify(record));
		fs.appendFileSync(file, `${serialized}\n`);
	} catch {
		// History is a convenience side effect; a failed write must not fail the scan.
	}
};

const isHistoryRecord = (value: unknown): value is HistoryRecord => {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.timestamp === "string" &&
		typeof record.score === "number" &&
		typeof record.errors === "number" &&
		typeof record.warnings === "number" &&
		typeof record.files === "number" &&
		typeof record.cliVersion === "string"
	);
};

export const readHistory = (directory: string): HistoryRecord[] => {
	const file = historyPath(directory);
	if (!file || !fs.existsSync(file)) return [];

	const records: HistoryRecord[] = [];
	for (const line of fs.readFileSync(file, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (isHistoryRecord(parsed)) records.push(parsed);
		} catch {
			// Skip malformed lines rather than aborting the whole history read.
		}
	}
	return records;
};
