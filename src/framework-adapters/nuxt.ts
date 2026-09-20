import {
	type RaigalAdapterOptions,
	type RaigalRunResult,
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
	maybeRunRaigal,
} from "./core.js";

type NuxtHookName = "build:before" | "nitro:build:before";

export interface NuxtLike {
	hook?: (name: NuxtHookName, callback: () => Promise<void>) => void;
	options?: {
		runtimeConfig?: Record<string, unknown>;
	};
}

export interface RaigalNuxtOptions extends RaigalAdapterOptions {
	runOnBuild?: boolean;
	hook?: NuxtHookName;
}
export type AislopNuxtOptions = RaigalNuxtOptions;

export interface NuxtModuleLike {
	meta: {
		name: string;
		configKey: string;
	};
	defaults: RaigalNuxtOptions;
	setup: (options: RaigalNuxtOptions, nuxt: NuxtLike) => void | Promise<void>;
}

const DEFAULTS: RaigalNuxtOptions = {
	command: "ci",
	enabled: false,
	failOnError: true,
	hook: "build:before",
};

export const createNuxtRaigalScripts = (): Record<string, string> =>
	createRaigalPackageScripts("nuxt");
export const createNuxtAislopScripts = createNuxtRaigalScripts;

export const createNuxtRaigalWorkflow = (): string => createRaigalCiWorkflow();
export const createNuxtAislopWorkflow = createNuxtRaigalWorkflow;

export const runNuxtRaigal = async (options: RaigalNuxtOptions = {}): Promise<RaigalRunResult> =>
	maybeRunRaigal("nuxt", {
		...options,
		enabled: options.enabled ?? options.runOnBuild ?? false,
	});
export const runNuxtAislop = runNuxtRaigal;

export const createRaigalNuxtModule = (defaults: RaigalNuxtOptions = {}): NuxtModuleLike => ({
	meta: {
		name: "@raigal/nuxt",
		configKey: "raigal",
	},
	defaults: { ...DEFAULTS, ...defaults },
	setup(options, nuxt) {
		const merged = { ...DEFAULTS, ...defaults, ...options };
		nuxt.hook?.(merged.hook ?? "build:before", async () => {
			await runNuxtRaigal(merged);
		});
	},
});
export const createAislopNuxtModule = createRaigalNuxtModule;

export default createRaigalNuxtModule();
