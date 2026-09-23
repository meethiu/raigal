import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Diagnostic } from "../engines/types.js";
import { formatFindingMessage } from "../output/rule-message.js";
import { toPosix } from "../utils/paths.js";
import type { FindingType } from "./types.js";

/**
 * Normalizes line text: trims leading/trailing whitespace and compresses
 * internal whitespace runs into a single space.
 */
export const normalizeLineText = (lineText: string): string => lineText.trim().replace(/\s+/g, " ");

/**
 * Computes deterministic finding fingerprint:
 * sha256(rule_id \0 path \0 whitespace-normalised line text), hex, first 32 chars.
 */
export const computeFindingFingerprint = (
	ruleId: string,
	relativePath: string,
	lineText: string,
): string => {
	const posixPath = toPosix(relativePath);
	const normalizedLine = normalizeLineText(lineText);
	const payload = `${ruleId}\0${posixPath}\0${normalizedLine}`;

	return createHash("sha256").update(payload, "utf-8").digest("hex").slice(0, 32);
};

const readLineFromFile = (absolutePath: string, lineNumber: number): string => {
	if (lineNumber <= 0) return "";
	try {
		if (!fs.existsSync(absolutePath)) return "";
		const content = fs.readFileSync(absolutePath, "utf-8");
		const lines = content.split(/\r?\n/);
		return lines[lineNumber - 1] ?? "";
	} catch {
		return "";
	}
};

/**
 * Converts an internal engine Diagnostic into a privacy-preserving Contract Finding.
 * No source code is transmitted; only rule, path, line number, severity, and fingerprint.
 */
export const toContractFinding = (
	diagnostic: Diagnostic,
	rootDirectory: string,
	lineTextOverride?: string,
): FindingType => {
	const absolutePath = path.isAbsolute(diagnostic.filePath)
		? diagnostic.filePath
		: path.resolve(rootDirectory, diagnostic.filePath);

	const relativePath = toPosix(path.relative(rootDirectory, absolutePath));
	const lineText =
		lineTextOverride !== undefined
			? lineTextOverride
			: readLineFromFile(absolutePath, diagnostic.line);

	const fingerprint = computeFindingFingerprint(diagnostic.rule, relativePath, lineText);

	const severity = diagnostic.severity === "error" ? "error" : "warning";

	return {
		rule_id: diagnostic.rule,
		engine: diagnostic.engine,
		severity,
		path: relativePath,
		line: Math.max(0, diagnostic.line),
		fingerprint,
		message: formatFindingMessage(diagnostic),
	};
};
