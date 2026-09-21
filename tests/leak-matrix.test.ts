import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeSecrets } from "./helpers/fake-secrets.js";
import { scanCommand } from "../src/commands/scan.js";
import { ciCommand } from "../src/commands/ci.js";
import { fixCommand } from "../src/commands/fix.js";
import { loadConfig } from "../src/config/index.js";
import { buildFeedback } from "../src/hooks/feedback.js";
import { handleRaigalScan, handleRaigalFix } from "../src/mcp/tools.js";
import { runEngines } from "../src/engines/orchestrator.js";
import { FIXED_SECRET_DIAGNOSTIC_MESSAGE, maskSecrets } from "../src/utils/mask-secrets.js";
import { renderAgentPlan } from "../src/commands/agent-plan.js";
import { createAgentSessionRecorder } from "../src/agents/session.js";
import { appendHistory } from "../src/utils/history.js";
import { renderError } from "../src/ui/error.js";
import { FIX_AGENT_FLAGS } from "../src/cli-fix-agents.js";
import { launchAgent } from "../src/commands/fix-code.js";
import type { Diagnostic } from "../src/engines/types.js";

const secrets = fakeSecrets();
const secretValues = Object.values(secrets).flatMap((v) =>
	v.includes("\n") ? [v, ...v.split("\n").filter((l) => l.length >= 10)] : [v],
);

const containsAnySecretSubstring = (output: string, minLength = 10): string | null => {
	for (const secret of secretValues) {
		if (secret.length < minLength) continue;
		// Check full secret
		if (output.includes(secret)) return secret;
		// Check substrings of length >= minLength
		for (let i = 0; i <= secret.length - minLength; i++) {
			const sub = secret.slice(i, i + minLength);
			if (output.includes(sub)) return sub;
		}
	}
	return null;
};

describe("Task 1: Secret Leak Matrix", () => {
	let testDir: string;
	let capturedStdout = "";
	let capturedStderr = "";
	const originalWrite = process.stdout.write;
	const originalStderrWrite = process.stderr.write;

	const startCapture = () => {
		capturedStdout = "";
		capturedStderr = "";
		process.stdout.write = ((chunk: any) => {
			capturedStdout += String(chunk);
			return true;
		}) as any;
		process.stderr.write = ((chunk: any) => {
			capturedStderr += String(chunk);
			return true;
		}) as any;
	};

	const stopCapture = () => {
		process.stdout.write = originalWrite;
		process.stderr.write = originalStderrWrite;
		return { stdout: capturedStdout, stderr: capturedStderr };
	};

	beforeAll(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), "raigal-leak-matrix-"));
		const srcDir = path.join(testDir, "src");
		fs.mkdirSync(srcDir, { recursive: true });

		fs.writeFileSync(
			path.join(testDir, "package.json"),
			JSON.stringify({ name: "raigal-leak-matrix-test", version: "1.0.0", private: true }, null, 2),
		);

		const cfgDir = path.join(testDir, ".raigal");
		fs.mkdirSync(cfgDir, { recursive: true });
		fs.writeFileSync(
			path.join(cfgDir, "config.yaml"),
			[
				"version: 1",
				"engines:",
				"  format: false",
				"  lint: false",
				"  code-quality: false",
				"  ai-slop: false",
				"  architecture: false",
				"  security: true",
			].join("\n"),
		);

		// Plausible source lines
		fs.writeFileSync(
			path.join(srcDir, "credentials.ts"),
			[
				`export const aws = "${secrets.aws}";`,
				`export const github = "${secrets.github}";`,
				`export const slack = "${secrets.slack}";`,
				`export const db = "${secrets.dbUrl}";`,
				`export const pwd = "${secrets.password}";`,
				`export const rsa = \`${secrets.pem}\`;`,
			].join("\n"),
		);

		// Unparseable file containing a secret
		fs.writeFileSync(
			path.join(srcDir, "unparseable.ts"),
			`const unparseable = ${secrets.github} {{{ syntax error`,
		);
	});

	afterAll(() => {
		stopCapture();
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it("maskSecrets redacts all known secret patterns", () => {
		for (const [kind, secret] of Object.entries(secrets)) {
			const masked = maskSecrets(`Key: ${secret}`);
			expect(containsAnySecretSubstring(masked)).toBeNull();
			expect(masked).toContain("[REDACTED:");
		}
	});

	it("engine diagnostics strip source line and have fixed message", async () => {
		const config = loadConfig(testDir);
		const results = await runEngines(
			{
				rootDirectory: testDir,
				languages: ["typescript"],
				frameworks: [],
				installedTools: {},
				config: {
					quality: config.quality,
					security: config.security,
					lint: config.lint,
				},
			},
			{
				security: true,
				lint: false,
				format: false,
				"code-quality": false,
				"ai-slop": false,
				architecture: false,
			},
		);

		const secDiags =
			results
				.find((r) => r.engine === "security")
				?.diagnostics.filter((d) => d.rule === "security/hardcoded-secret") ?? [];

		expect(secDiags.length).toBeGreaterThan(0);
		for (const diag of secDiags) {
			expect(diag.message).toBe(
				"Hardcoded credential. Rotate it and load it from the environment.",
			);
			expect(diag.detail).toBeUndefined();
			expect(containsAnySecretSubstring(JSON.stringify(diag))).toBeNull();
		}
	});

	it("fix --prompt does not leak secret values", async () => {
		startCapture();
		try {
			await fixCommand(testDir, loadConfig(testDir), {
				verbose: false,
				prompt: true,
				showHeader: false,
			});
		} finally {
			const { stdout, stderr } = stopCapture();
			const combined = stdout + stderr;
			const leaked = containsAnySecretSubstring(combined);
			expect(
				leaked,
				`Found leaked secret or substring "${leaked}" in fix --prompt output`,
			).toBeNull();
		}
	});

	it("scan does not leak secret values", async () => {
		startCapture();
		try {
			await scanCommand(testDir, loadConfig(testDir), { verbose: true });
		} finally {
			const { stdout, stderr } = stopCapture();
			const combined = stdout + stderr;
			const leaked = containsAnySecretSubstring(combined);
			expect(leaked, `Found leaked secret or substring "${leaked}" in scan output`).toBeNull();
		}
	});

	it("scan --json does not leak secret values", async () => {
		startCapture();
		try {
			await scanCommand(testDir, loadConfig(testDir), { json: true });
		} finally {
			const { stdout, stderr } = stopCapture();
			const combined = stdout + stderr;
			const leaked = containsAnySecretSubstring(combined);
			expect(
				leaked,
				`Found leaked secret or substring "${leaked}" in scan --json output`,
			).toBeNull();
		}
	});

	it("scan --sarif does not leak secret values", async () => {
		startCapture();
		try {
			await scanCommand(testDir, loadConfig(testDir), { sarif: true });
		} finally {
			const { stdout, stderr } = stopCapture();
			const combined = stdout + stderr;
			const leaked = containsAnySecretSubstring(combined);
			expect(
				leaked,
				`Found leaked secret or substring "${leaked}" in scan --sarif output`,
			).toBeNull();
		}
	});

	it("ci and ci --human do not leak secret values", async () => {
		for (const human of [false, true]) {
			startCapture();
			try {
				await ciCommand(testDir, loadConfig(testDir), { human });
			} finally {
				const { stdout, stderr } = stopCapture();
				const combined = stdout + stderr;
				const leaked = containsAnySecretSubstring(combined);
				expect(
					leaked,
					`Found leaked secret or substring "${leaked}" in ci output (human: ${human})`,
				).toBeNull();
			}
		}
	});

	it("hook envelope does not leak secret values", async () => {
		const config = loadConfig(testDir);
		const results = await runEngines(
			{
				rootDirectory: testDir,
				languages: ["typescript"],
				frameworks: [],
				installedTools: {},
				config: {
					quality: config.quality,
					security: config.security,
					lint: config.lint,
				},
			},
			{
				security: true,
				lint: false,
				format: false,
				"code-quality": false,
				"ai-slop": false,
				architecture: false,
			},
		);
		const diags = results.flatMap((r) => r.diagnostics);
		const feedback = buildFeedback(diags, 50, testDir);
		const feedbackStr = JSON.stringify(feedback);
		const leaked = containsAnySecretSubstring(feedbackStr);
		expect(
			leaked,
			`Found leaked secret or substring "${leaked}" in hook feedback envelope`,
		).toBeNull();
	});

	it("MCP raigal_scan does not leak secret values", async () => {
		const mcpDir = path.join(process.cwd(), "tests", "fixtures", "mcp-leak-fixture");
		fs.mkdirSync(path.join(mcpDir, "src"), { recursive: true });
		fs.writeFileSync(
			path.join(mcpDir, "package.json"),
			JSON.stringify({ name: "mcp-leak-fixture", version: "1.0.0", private: true }, null, 2),
		);
		fs.writeFileSync(
			path.join(mcpDir, "src", "credentials.ts"),
			`export const aws = "${secrets.aws}";\nexport const pwd = "${secrets.password}";`,
		);
		try {
			const response = await handleRaigalScan({ path: mcpDir });
			const respStr = JSON.stringify(response);
			const leaked = containsAnySecretSubstring(respStr);
			expect(
				leaked,
				`Found leaked secret or substring "${leaked}" in MCP scan response`,
			).toBeNull();
		} finally {
			fs.rmSync(mcpDir, { recursive: true, force: true });
		}
	});

	it("fix --dry-run and fix -d do not leak secret values", async () => {
		startCapture();
		try {
			await fixCommand(testDir, loadConfig(testDir), {
				verbose: true,
				dryRun: true,
				showHeader: false,
			});
		} finally {
			const { stdout, stderr } = stopCapture();
			const combined = stdout + stderr;
			const leaked = containsAnySecretSubstring(combined);
			expect(
				leaked,
				`Found leaked secret or substring "${leaked}" in fix --dry-run output`,
			).toBeNull();
		}
	});

	it("agent plan does not leak secret values", () => {
		const scan = {
			score: 80,
			diagnostics: [
				{
					filePath: "src/credentials.ts",
					engine: "security" as const,
					rule: "security/hardcoded-secret",
					severity: "error" as const,
					message: FIXED_SECRET_DIAGNOSTIC_MESSAGE,
					line: 2,
					column: 0,
					category: "Security",
					fixable: false,
					redactSource: true,
				},
			],
		};
		const rendered = renderAgentPlan({
			directory: testDir,
			git: { root: testDir, branch: "main", head: "abc1234", dirty: false },
			provider: null,
			scan: scan as any,
			findings: scan.diagnostics,
			blockers: [],
			options: { provider: "codex", targetScore: 90 } as any,
		});
		const leaked = containsAnySecretSubstring(rendered);
		expect(leaked, `Found leaked secret or substring "${leaked}" in agent plan`).toBeNull();
	});

	it("agent session and history do not leak secrets", () => {
		const recorder = createAgentSessionRecorder(testDir);
		recorder.append("step", {
			content: `Secret used: ${secrets.aws} and password: "${secrets.password}"`,
		});
		const content = fs.readFileSync(recorder.path, "utf-8");
		expect(containsAnySecretSubstring(content)).toBeNull();
		expect(content).toContain("[REDACTED:aws]");
		expect(content).toContain("[REDACTED:password]");

		appendHistory({
			directory: testDir,
			score: 80,
			errors: 0,
			warnings: 0,
			files: 1,
			details: `Leak attempt: ${secrets.github}`,
		} as any);
		const historyContent = fs.readFileSync(path.join(testDir, ".raigal", "history.jsonl"), "utf-8");
		expect(containsAnySecretSubstring(historyContent)).toBeNull();
		expect(historyContent).toContain("[REDACTED:github]");
	});

	it("renderError masks secrets in message and cause", () => {
		const rendered = renderError({
			message: `Failed to connect with ${secrets.dbUrl}`,
			cause: `Unparseable file with key: ${secrets.password}`,
		});
		expect(containsAnySecretSubstring(rendered)).toBeNull();
		expect(rendered).toContain("[REDACTED:database_url]");
		expect(rendered).toContain("[REDACTED:password]");
	});

	it("every fix --<agent> does not leak secret values", () => {
		const fakeBinDir = path.join(testDir, "bin");
		fs.mkdirSync(fakeBinDir, { recursive: true });
		const oldPath = process.env.PATH;
		process.env.PATH = `${fakeBinDir}${path.delimiter}${oldPath}`;

		const fakeDiags: Diagnostic[] = [
			{
				filePath: "src/credentials.ts",
				engine: "security",
				rule: "security/hardcoded-secret",
				severity: "error",
				message: FIXED_SECRET_DIAGNOSTIC_MESSAGE,
				line: 1,
				column: 0,
				category: "Security",
				fixable: false,
				redactSource: true,
			},
		];

		try {
			for (const a of FIX_AGENT_FLAGS) {
				const binName = a.flag === "vscode" ? "code" : a.flag;
				const binPath = path.join(fakeBinDir, binName);
				fs.writeFileSync(binPath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });

				startCapture();
				try {
					launchAgent(a.flag, testDir, fakeDiags, 50);
				} finally {
					const { stdout, stderr } = stopCapture();
					const combined = stdout + stderr;
					const leaked = containsAnySecretSubstring(combined);
					expect(leaked, `Found leaked secret in fix --${a.flag} output`).toBeNull();
				}
			}
		} finally {
			process.env.PATH = oldPath;
		}
	});
});
