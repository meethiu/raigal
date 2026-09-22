import {
	type RaigalAdapterOptions,
	type RaigalRunResult,
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
	maybeRunRaigal,
} from "./core.js";

export interface ExpoConfigLike {
	extra?: Record<string, unknown>;
	[name: string]: unknown;
}

export interface RaigalExpoOptions extends RaigalAdapterOptions {
	/**
	 * Expo config plugins run while resolving app config. Keep scan execution out
	 * of that path unless a host integration explicitly opts in.
	 */
	runDuringConfig?: boolean;
}
export type AislopExpoOptions = RaigalExpoOptions;

export const createExpoRaigalScripts = (): Record<string, string> =>
	createRaigalPackageScripts("expo");
export const createExpoAislopScripts = createExpoRaigalScripts;

export const createExpoRaigalWorkflow = (): string => createRaigalCiWorkflow();
export const createExpoAislopWorkflow = createExpoRaigalWorkflow;

export const runExpoRaigal = async (options: RaigalExpoOptions = {}): Promise<RaigalRunResult> =>
	maybeRunRaigal("expo", {
		...options,
		enabled: options.enabled ?? options.runDuringConfig ?? false,
	});
export const runExpoAislop = runExpoRaigal;

const withRaigalExpo = <TConfig extends ExpoConfigLike>(
	config: TConfig,
	_options: RaigalExpoOptions = {},
): TConfig => {
	const extra = {
		...config.extra,
		raigal: {
			command: "npx --yes @methiu/raigal@latest ci",
			hook: "raigal hook install",
			enabled: true,
		},
		aislop: {
			command: "npx --yes @methiu/raigal@latest ci",
			hook: "raigal hook install",
			enabled: true,
		},
	};

	return { ...config, extra };
};

export const withAislopExpo = withRaigalExpo;
export default withRaigalExpo;
