import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initCommand, writeGithubWorkflow } from "../../src/commands/init.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aislop-init-workflow-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("writeGithubWorkflow", () => {
	it("writes .github/workflows/raigal.yml (or aislop.yml) when enabled and none exists", () => {
		const result = writeGithubWorkflow(tmpDir, true);
		expect(result.status).toBe("written");
		if (result.status === "written") {
			expect(result.relativePath).toMatch(/\.github\/workflows\/(raigal|aislop)\.yml/);
		}
		const writtenPath = path.join(tmpDir, result.status === "written" ? result.relativePath : ".github/workflows/raigal.yml");
		const body = fs.readFileSync(writtenPath, "utf-8");
		expect(body).toMatch(/name:\s+(raigal|aislop)/);
		expect(body).toMatch(/uses:\s+(?:scanaislop|meethiu)\/(raigal|aislop)@v1/);
		expect(body).toContain("version: latest");
	});

	it("returns declined (no write) when disabled", () => {
		const result = writeGithubWorkflow(tmpDir, false);
		expect(result.status).toBe("declined");
		expect(fs.existsSync(path.join(tmpDir, ".github/workflows/raigal.yml"))).toBe(false);
		expect(fs.existsSync(path.join(tmpDir, ".github/workflows/aislop.yml"))).toBe(false);
	});

	it("skips without overwriting if the file already exists", () => {
		const workflowPath = path.join(tmpDir, ".github/workflows/raigal.yml");
		fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
		fs.writeFileSync(workflowPath, "# user's own workflow\n");
		const result = writeGithubWorkflow(tmpDir, true);
		expect(result.status).toBe("skipped-exists");
		expect(fs.readFileSync(workflowPath, "utf-8")).toBe("# user's own workflow\n");
	});
});

describe("init --strict", () => {
	it("writes a strict config, architecture rules, and CI workflow without prompting", async () => {
		await initCommand(tmpDir, { strict: true, printBrand: false });

		const configPath = fs.existsSync(path.join(tmpDir, ".raigal/config.yml"))
			? path.join(tmpDir, ".raigal/config.yml")
			: path.join(tmpDir, ".aislop/config.yml");
		const config = fs.readFileSync(configPath, "utf-8");
		expect(config).toContain("architecture: true");
		expect(config).toContain("typecheck: true");
		expect(config).toContain("expoDoctor: false");
		expect(config).toContain("failBelow: 85");
		expect(
			fs.existsSync(path.join(tmpDir, ".raigal/rules.yml")) ||
			fs.existsSync(path.join(tmpDir, ".aislop/rules.yml")),
		).toBe(true);
		expect(
			fs.existsSync(path.join(tmpDir, ".github/workflows/raigal.yml")) ||
			fs.existsSync(path.join(tmpDir, ".github/workflows/aislop.yml")),
		).toBe(true);
	});
});
