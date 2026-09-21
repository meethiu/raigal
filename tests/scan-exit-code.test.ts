import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ciCommand } from "../src/commands/ci.js";
import { scanCommand } from "../src/commands/scan.js";
import { computeCiExitCode, computeScanExitCode } from "../src/commands/scan-exit-code.js";
import { parseConfig } from "../src/config/schema.js";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("computeScanExitCode (legacy backwards compatibility)", () => {
	it("fails on error diagnostics even when the score is withheld", () => {
		expect(
			computeScanExitCode({ hasErrors: true, scoreable: false, score: 0, failBelow: 70 }),
		).toBe(1);
	});

	it("fails on error diagnostics when scoreable", () => {
		expect(
			computeScanExitCode({ hasErrors: true, scoreable: true, score: 100, failBelow: 70 }),
		).toBe(1);
	});

	it("does not gate on a withheld score below the threshold", () => {
		expect(
			computeScanExitCode({ hasErrors: false, scoreable: false, score: 0, failBelow: 70 }),
		).toBe(0);
	});

	it("fails a scoreable run below the threshold", () => {
		expect(
			computeScanExitCode({ hasErrors: false, scoreable: true, score: 50, failBelow: 70 }),
		).toBe(1);
	});

	it("passes a scoreable run at or above the threshold", () => {
		expect(
			computeScanExitCode({ hasErrors: false, scoreable: true, score: 80, failBelow: 70 }),
		).toBe(0);
	});
});

describe("Task 6: computeScanExitCode with --fail-on", () => {
	it("never applies score gate when failOn is specified or in scan mode", () => {
		// Even with low score and failBelow 80, if hasErrors is false and failOn is error: exit 0!
		expect(
			computeScanExitCode({
				hasErrors: false,
				hasWarnings: true,
				scoreable: true,
				score: 20,
				failBelow: 80,
				failOn: "error",
			}),
		).toBe(0);
	});

	it("exit code matrix under each --fail-on value", () => {
		// None findings
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: false, failOn: "none" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: false, failOn: "error" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: false, failOn: "warning" })).toBe(
			0,
		);

		// Warning-only findings
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: true, failOn: "none" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: true, failOn: "error" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: false, hasWarnings: true, failOn: "warning" })).toBe(1);

		// Error findings
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: false, failOn: "none" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: false, failOn: "error" })).toBe(1);
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: false, failOn: "warning" })).toBe(1);

		// Error + Warning findings
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: true, failOn: "none" })).toBe(0);
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: true, failOn: "error" })).toBe(1);
		expect(computeScanExitCode({ hasErrors: true, hasWarnings: true, failOn: "warning" })).toBe(1);
	});
});

describe("Task 6: computeCiExitCode", () => {
	it("maintains CI semantics unchanged: fails on errors or score < failBelow", () => {
		expect(computeCiExitCode({ hasErrors: true, scoreable: true, score: 100, failBelow: 70 })).toBe(
			1,
		);
		expect(computeCiExitCode({ hasErrors: false, scoreable: true, score: 50, failBelow: 70 })).toBe(
			1,
		);
		expect(computeCiExitCode({ hasErrors: false, scoreable: true, score: 80, failBelow: 70 })).toBe(
			0,
		);
		expect(computeCiExitCode({ hasErrors: false, scoreable: false, score: 0, failBelow: 70 })).toBe(
			0,
		);
	});
});

describe("Task 6: scan vs ci command execution", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-scan-test-"));
		execSync("git init", { cwd: tmpDir, stdio: "ignore" });
		execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "ignore" });
		execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "ignore" });
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("scan does not fail on warning findings by default even when score is below failBelow", async () => {
		// A file with a console statement produces a warning finding (ai-slop/console-leftover)
		const code = "export const answer = () => {\n  console.log('hello');\n  return 42;\n};\n";
		fs.writeFileSync(path.join(tmpDir, "index.ts"), code);

		const config = parseConfig({
			ci: { failBelow: 100 },
			engines: { format: false, lint: false, architecture: false, security: false },
		});

		// scan default failOn is "error": should exit 0 because finding is only warning
		const scanResult = await scanCommand(tmpDir, config, {
			changes: false,
			staged: false,
			verbose: false,
			json: true,
			command: "scan",
		});
		expect(scanResult.warningCount).toBeGreaterThan(0);
		expect(scanResult.errorCount).toBe(0);
		expect(scanResult.exitCode).toBe(0);

		// With failOn: "warning": should exit 1
		const scanWarningResult = await scanCommand(tmpDir, config, {
			changes: false,
			staged: false,
			verbose: false,
			json: true,
			failOn: "warning",
		});
		expect(scanWarningResult.exitCode).toBe(1);

		// With failOn: "none": should exit 0
		const scanNoneResult = await scanCommand(tmpDir, config, {
			changes: false,
			staged: false,
			verbose: false,
			json: true,
			failOn: "none",
		});
		expect(scanNoneResult.exitCode).toBe(0);

		// But CI command with failBelow: 100 fails with exit code 1 because score < 100!
		const ciResult = await ciCommand(tmpDir, config, {});
		expect(ciResult.exitCode).toBe(1);
	});

	it("CLI scan obeys --fail-on and --staged", () => {
		const code = "export const answer = () => {\n  console.log('debug');\n  return 42;\n};\n";
		fs.writeFileSync(path.join(tmpDir, "index.ts"), code);
		execSync("git add index.ts", { cwd: tmpDir, stdio: "ignore" });

		// Default scan --staged: exits 0 on warning
		const resDefault = spawnSync(process.execPath, [CLI_PATH, "scan", "--staged"], {
			cwd: tmpDir,
			encoding: "utf-8",
			env: { ...process.env, CI: "1", NO_COLOR: "1" },
		});
		expect(resDefault.status).toBe(0);

		// scan --staged --fail-on warning: exits 1 on warning
		const resWarning = spawnSync(
			process.execPath,
			[CLI_PATH, "scan", "--staged", "--fail-on", "warning"],
			{
				cwd: tmpDir,
				encoding: "utf-8",
				env: { ...process.env, CI: "1", NO_COLOR: "1" },
			},
		);
		expect(resWarning.status).toBe(1);

		// scan --json still parses as valid JSON
		const resJson = spawnSync(process.execPath, [CLI_PATH, "scan", "--json"], {
			cwd: tmpDir,
			encoding: "utf-8",
			env: { ...process.env, CI: "1", NO_COLOR: "1" },
		});
		expect(resJson.status).toBe(0);
		expect(() => JSON.parse(resJson.stdout)).not.toThrow();
		const parsed = JSON.parse(resJson.stdout);
		expect(parsed).toHaveProperty("score");
	});
});
