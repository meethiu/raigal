import {
	type RaigalAdapterOptions,
	type RaigalFramework,
	type RaigalRunResult,
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
	maybeRunRaigal,
} from "./core.js";

type ViteApply = "serve" | "build";

export interface VitePluginLike {
	name: string;
	apply?: ViteApply;
	buildStart?: () => Promise<void>;
	closeBundle?: () => Promise<void>;
}

export interface RaigalViteOptions extends RaigalAdapterOptions {
	framework?: Extract<
		RaigalFramework,
		"vite" | "tanstack-start" | "redwoodsdk" | "t3" | "sveltekit"
	>;
	runOnBuild?: boolean;
	hook?: "buildStart" | "closeBundle";
}
export type AislopViteOptions = RaigalViteOptions;

export const createViteRaigalScripts = (
	framework: RaigalViteOptions["framework"] = "vite",
): Record<string, string> => {
	const scripts = createRaigalPackageScripts(framework);
	scripts["raigal:build-gate"] = "raigal ci --changes";
	scripts["aislop:build-gate"] = "raigal ci --changes";
	return scripts;
};
export const createViteAislopScripts = createViteRaigalScripts;

export const createViteRaigalWorkflow = (): string => createRaigalCiWorkflow();
export const createViteAislopWorkflow = createViteRaigalWorkflow;

export const runViteRaigal = async (options: RaigalViteOptions = {}): Promise<RaigalRunResult> => {
	const framework = options.framework ?? "vite";
	return maybeRunRaigal(framework, {
		...options,
		enabled: options.enabled ?? options.runOnBuild ?? false,
	});
};
export const runRaigalVite = runViteRaigal;
export const runViteAislop = runViteRaigal;

const raigalVite = (options: RaigalViteOptions = {}): VitePluginLike => {
	const hook = options.hook ?? "closeBundle";
	const run = async () => {
		await runViteRaigal(options);
	};

	return {
		name: "raigal:vite",
		apply: "build",
		...(hook === "buildStart" ? { buildStart: run } : { closeBundle: run }),
	};
};

export const aislopVite = raigalVite;
export default raigalVite;
