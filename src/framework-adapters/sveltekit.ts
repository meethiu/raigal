import {
	type RaigalRunResult,
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
} from "./core.js";
import raigalVite, { type RaigalViteOptions, type VitePluginLike, runRaigalVite } from "./vite.js";

export type RaigalSvelteKitOptions = Omit<RaigalViteOptions, "framework">;
export type AislopSvelteKitOptions = RaigalSvelteKitOptions;

export const createSvelteKitRaigalScripts = (): Record<string, string> =>
	createRaigalPackageScripts("sveltekit");
export const createSvelteKitAislopScripts = createSvelteKitRaigalScripts;

export const createSvelteKitRaigalWorkflow = (): string => createRaigalCiWorkflow();
export const createSvelteKitAislopWorkflow = createSvelteKitRaigalWorkflow;

export const runSvelteKitRaigal = async (
	options: RaigalSvelteKitOptions = {},
): Promise<RaigalRunResult> => runRaigalVite({ ...options, framework: "sveltekit" });
export const runSvelteKitAislop = runSvelteKitRaigal;

const raigalSvelteKit = (options: RaigalSvelteKitOptions = {}): VitePluginLike =>
	raigalVite({ ...options, framework: "sveltekit" });

export const aislopSvelteKit = raigalSvelteKit;
export default raigalSvelteKit;
