import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/index.js";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-config-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

const writeConfig = (relPath: string, content: string): string => {
	const full = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf-8");
	return full;
};

describe("Task 5: Fail-closed configuration on exit code 2", () => {
	it("detects unknown key in .raigal/config.yaml and provides typo suggestion", () => {
		writeConfig(".raigal/config.yaml", "quality:\n  maxFuncLoc: 50\n");

		expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
		try {
			loadConfig(tmpDir);
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			const configErr = err as ConfigError;
			expect(configErr.filePath.replace(/\\/g, '/')).toContain(".raigal/config.yaml");
			expect(configErr.message).toMatch(/maxFuncLoc/);
			expect(configErr.message).toMatch(/maxFunctionLoc/i);
		}
	});

	it("detects top-level typo in .raigal/config.json with suggestion", () => {
		writeConfig(".raigal/config.json", JSON.stringify({ engins: { format: false } }));

		expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
		try {
			loadConfig(tmpDir);
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			const configErr = err as ConfigError;
			expect(configErr.filePath.replace(/\\/g, '/')).toContain(".raigal/config.json");
			expect(configErr.message).toMatch(/engins/);
			expect(configErr.message).toMatch(/engines/i);
		}
	});

	it("detects unknown key in root .raigal.json", () => {
		writeConfig(".raigal.json", JSON.stringify({ unknownTopKey: 123 }));

		expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
		try {
			loadConfig(tmpDir);
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			const configErr = err as ConfigError;
			expect(configErr.filePath).toContain(".raigal.json");
			expect(configErr.message).toMatch(/unknownTopKey/);
		}
	});

	it("detects unknown key in legacy .aislop/config.yaml", () => {
		writeConfig(".aislop/config.yaml", "secuity:\n  audit: false\n");

		expect(() => loadConfig(tmpDir)).toThrow(ConfigError);
		try {
			loadConfig(tmpDir);
		} catch (err) {
			expect(err).toBeInstanceOf(ConfigError);
			const configErr = err as ConfigError;
			expect(configErr.filePath.replace(/\\/g, '/')).toContain(".aislop/config.yaml");
			expect(configErr.message).toMatch(/secuity/);
			expect(configErr.message).toMatch(/security/i);
		}
	});

	it("CLI scan exits with code 2 on unknown config key", () => {
		writeConfig(".raigal/config.yaml", "quality:\n  maxFuncLoc: 50\n");
		writeConfig("index.ts", "export const x = 1;\n");

		const result = spawnSync("node", [CLI_PATH, "scan", "."], {
			cwd: tmpDir,
			encoding: "utf-8",
		});

		expect(result.status).toBe(2);
		expect(result.stderr).toMatch(/config\.yaml/);
		expect(result.stderr).toMatch(/maxFuncLoc/);
		expect(result.stderr).toMatch(/maxFunctionLoc/i);
	});

	it("CLI ci exits with code 2 on unknown config key", () => {
		writeConfig(".raigal/config.json", JSON.stringify({ engins: { format: false } }));
		writeConfig("index.ts", "export const x = 1;\n");

		const result = spawnSync("node", [CLI_PATH, "ci", "."], {
			cwd: tmpDir,
			encoding: "utf-8",
		});

		expect(result.status).toBe(2);
		expect(result.stderr).toMatch(/config\.json/);
		expect(result.stderr).toMatch(/engins/);
		expect(result.stderr).toMatch(/engines/i);
	});

	it("CLI fix exits with code 2 on unknown config key", () => {
		writeConfig(".raigal/config.yaml", "telemetry:\n  enbled: false\n");
		writeConfig("index.ts", "export const x = 1;\n");

		const result = spawnSync("node", [CLI_PATH, "fix", "."], {
			cwd: tmpDir,
			encoding: "utf-8",
		});

		expect(result.status).toBe(2);
		expect(result.stderr).toMatch(/config\.yaml/);
		expect(result.stderr).toMatch(/enbled/);
		expect(result.stderr).toMatch(/enabled/i);
	});

	it("hook pre-commit / scoped-scan prints 1 line and exits 0 on invalid config", async () => {
		writeConfig(".raigal/config.yaml", "quality:\n  badKey: 123\n");
		const testFile = writeConfig("index.ts", "export const x = 1;\n");

		const { runScopedScan } = await import("../src/hooks/io/scoped-scan.js");
		const stderrWrite = process.stderr.write;
		let stderrOutput = "";
		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderrOutput += String(chunk);
			return true;
		}) as typeof process.stderr.write;

		try {
			const res = await runScopedScan(tmpDir, [testFile]);
			expect(res.score).toBe(100);
			const lines = stderrOutput.trim().split("\n");
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatch(/invalid config/i);
		} finally {
			process.stderr.write = stderrWrite;
		}
	});

	it("valid config with extends passes strict validation", () => {
		writeConfig("base.yaml", "quality:\n  maxFunctionLoc: 40\n");
		writeConfig(".raigal/config.yaml", "extends: ../base.yaml\nci:\n  failBelow: 80\n");

		const config = loadConfig(tmpDir);
		expect(config.quality.maxFunctionLoc).toBe(40);
		expect(config.ci.failBelow).toBe(80);
	});
});
