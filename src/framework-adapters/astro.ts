import {
	type RaigalAdapterOptions,
	type RaigalRunResult,
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
	maybeRunRaigal,
} from "./core.js";

export interface AstroIntegration {
	name: string;
	hooks: {
		"astro:build:start"?: () => Promise<void>;
	};
}

export interface RaigalAstroOptions extends RaigalAdapterOptions {
	runOnBuild?: boolean;
}
export type AislopAstroOptions = RaigalAstroOptions;

export const createAstroRaigalScripts = (): Record<string, string> =>
	createRaigalPackageScripts("astro");
export const createAstroAislopScripts = createAstroRaigalScripts;

export const createAstroRaigalWorkflow = (): string => createRaigalCiWorkflow();
export const createAstroAislopWorkflow = createAstroRaigalWorkflow;

export const runAstroRaigal = async (options: RaigalAstroOptions = {}): Promise<RaigalRunResult> =>
	maybeRunRaigal("astro", {
		...options,
		enabled: options.enabled ?? options.runOnBuild ?? false,
	});
export const runAstroAislop = runAstroRaigal;

const raigalAstro = (options: RaigalAstroOptions = {}): AstroIntegration => ({
	name: "@raigal/astro",
	hooks: {
		"astro:build:start": async () => {
			await runAstroRaigal(options);
		},
	},
});

export const aislopAstro = raigalAstro;
export default raigalAstro;
