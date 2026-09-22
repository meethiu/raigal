import { spawn } from "node:child_process";
import process from "node:process";

export type RaigalFramework =
	| "astro"
	| "expo"
	| "nuxt"
	| "sveltekit"
	| "vite"
	| "tanstack-start"
	| "redwoodsdk"
	| "t3";

type RaigalAdapterCommand = "ci" | "scan";

export interface RaigalRunRequest {
	framework: RaigalFramework;
	bin: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
}

export interface RaigalRunResult {
	command: string;
	args: string[];
	exitCode: number | null;
	signal: NodeJS.Signals | null;
	skipped: boolean;
}

type RaigalRunner = (request: RaigalRunRequest) => RaigalRunResult | Promise<RaigalRunResult>;

export interface RaigalAdapterOptions {
	/**
	 * Running during a framework build is opt-in so integrations never surprise
	 * local dev servers or production builds.
	 */
	enabled?: boolean;
	command?: RaigalAdapterCommand;
	args?: string[];
	bin?: string;
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	failOnError?: boolean;
	runner?: RaigalRunner;
}

interface RaigalPackageScriptsOptions {
	command?: RaigalAdapterCommand;
	includeAgent?: boolean;
	includeHook?: boolean;
}

const DEFAULT_ARGS: Record<RaigalAdapterCommand, string[]> = {
	ci: ["ci"],
	scan: ["scan"],
};

export const resolveRaigalRunRequest = (
	framework: RaigalFramework,
	options: RaigalAdapterOptions = {},
): RaigalRunRequest => {
	const command = options.command ?? "ci";
	const env = options.env ? { ...process.env, ...options.env } : { ...process.env };
	return {
		framework,
		bin: options.bin ?? "raigal",
		args: [...DEFAULT_ARGS[command], ...(options.args ?? [])],
		cwd: options.cwd ?? process.cwd(),
		env,
	};
};

const runRaigal = async (request: RaigalRunRequest): Promise<RaigalRunResult> =>
	new Promise((resolve) => {
		const child = spawn(request.bin, request.args, {
			cwd: request.cwd,
			env: request.env,
			stdio: "inherit",
		});

		child.on("close", (exitCode, signal) => {
			resolve({
				command: request.bin,
				args: request.args,
				exitCode,
				signal,
				skipped: false,
			});
		});
	});

export const maybeRunRaigal = async (
	framework: RaigalFramework,
	options: RaigalAdapterOptions = {},
): Promise<RaigalRunResult> => {
	const request = resolveRaigalRunRequest(framework, options);

	if (options.enabled !== true) {
		return {
			command: request.bin,
			args: request.args,
			exitCode: 0,
			signal: null,
			skipped: true,
		};
	}

	const result = await (options.runner ?? runRaigal)(request);
	if (result.exitCode === 30 || result.exitCode === 31) {
		process.stderr.write(
			`[raigal] Analysis skipped for ${framework}: organization entitlement required.\n`,
		);
		return { ...result, exitCode: 0, skipped: true };
	}

	if (options.failOnError !== false && !result.skipped && result.exitCode !== 0) {
		throw new Error(
			`raigal ${request.args.join(" ")} failed for ${framework} with exit code ${String(
				result.exitCode,
			)}`,
		);
	}

	return result;
};

export const createRaigalPackageScripts = (
	_framework: RaigalFramework,
	options: RaigalPackageScriptsOptions = {},
): Record<string, string> => {
	const command = options.command ?? "ci";
	const scripts: Record<string, string> = {
		"raigal:scan": "raigal scan",
		"raigal:ci": `raigal ${command}`,
		"aislop:scan": "raigal scan",
		"aislop:ci": `raigal ${command}`,
	};

	if (options.includeAgent ?? true) {
		scripts["raigal:agent"] = "raigal agent";
		scripts["aislop:agent"] = "raigal agent";
	}

	if (options.includeHook ?? true) {
		scripts["raigal:hook"] = "raigal hook install";
		scripts["aislop:hook"] = "raigal hook install";
	}

	return scripts;
};

export const createRaigalCiWorkflow = (
	packageManagerCommand = "npx --yes @methiu/raigal@latest ci",
): string =>
	[
		"name: raigal",
		"",
		"on:",
		"  pull_request:",
		"  push:",
		"    branches: [main]",
		"",
		"permissions:",
		"  contents: read",
		"  id-token: write",
		"",
		"jobs:",
		"  quality-gate:",
		"    runs-on: ubuntu-latest",
		"    steps:",
		"      - uses: actions/checkout@v4",
		"      - uses: actions/setup-node@v4",
		"        with:",
		"          node-version: 22",
		`      - run: ${packageManagerCommand}`,
		"",
	].join("\n");
