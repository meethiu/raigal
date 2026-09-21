import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Run } from "../../src/cloud/contract.js";
import {
	CloudRunRecorder,
	finishActiveRecorder,
	getActiveRecorder,
	startRunRecorder,
} from "../../src/cloud/recorder.js";
import { telemetryShowCommand } from "../../src/commands/telemetry-show.js";

describe("CloudRunRecorder and telemetry --show", () => {
	let tempDir: string;
	const originalStateDir = process.env.RAIGAL_STATE_DIR;
	const originalConfigDir = process.env.RAIGAL_CONFIG_DIR;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-recorder-test-"));
		process.env.RAIGAL_STATE_DIR = tempDir;
		process.env.RAIGAL_CONFIG_DIR = tempDir;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		if (originalStateDir !== undefined) {
			process.env.RAIGAL_STATE_DIR = originalStateDir;
		} else {
			delete process.env.RAIGAL_STATE_DIR;
		}
		if (originalConfigDir !== undefined) {
			process.env.RAIGAL_CONFIG_DIR = originalConfigDir;
		} else {
			delete process.env.RAIGAL_CONFIG_DIR;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("records run lifecycle, filters flags, and produces valid contract Run payload", async () => {
		const recorder = new CloudRunRecorder("scan", process.cwd(), [
			"--changes",
			"--format",
			"json", // format value should be scrubbed by flag parser
			"-d",
		]);

		recorder.recordStep("engine:ai-slop", 120, true, { findings: 2 });
		recorder.recordStep("engine:security", 45, true, { findings: 0 });

		recorder.setReport({
			score: 95,
			scoreable: true,
			engine_scores: { "ai-slop": 95 },
			files_scanned: 10,
			findings: [],
		});

		recorder.setPolicyMeta(1, "policy_hash_123");

		const payload = recorder.buildRunPayload(0);

		// Validates against strict Zod schema
		const parsed = Run.safeParse(payload);
		expect(parsed.success).toBe(true);

		expect(payload.command).toBe("scan");
		expect(payload.flags).toEqual(["changes", "format", "json", "d"]);
		expect(payload.steps).toHaveLength(2);
		expect(payload.policy?.version).toBe(1);
		expect(payload.report?.score).toBe(95);

		await recorder.finish(0);
	});

	it("manages global active recorder instance", async () => {
		expect(getActiveRecorder()).toBeNull();

		const recorder = startRunRecorder("ci", process.cwd(), ["--staged"]);
		expect(getActiveRecorder()).toBe(recorder);

		await finishActiveRecorder(0);
		expect(getActiveRecorder()).toBeNull();
	});

	it("telemetry --show prints recorded run details without secrets", async () => {
		const recorder = new CloudRunRecorder("scan", process.cwd(), ["--changes"]);
		recorder.setReport({
			score: 88,
			scoreable: true,
			files_scanned: 15,
			findings: [
				{
					rule_id: "ai-slop/trivial-comment",
					engine: "ai-slop",
					path: "src/app.ts",
					line: 10,
					severity: "warning",
					fingerprint: "11112222333344445555666677778888",
				},
			],
		});
		await recorder.finish(0);

		let output = "";
		vi.spyOn(process.stdout, "write").mockImplementation((str) => {
			output += String(str);
			return true;
		});

		await telemetryShowCommand();

		expect(output).toContain("Raigal Cloud Telemetry & Outbox Status");
		expect(output).toContain("Last Run ID:");
		expect(output).toContain("88/100");
		expect(output).toContain("No source code or secret values");
	});
});
