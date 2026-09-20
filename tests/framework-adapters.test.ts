import { describe, expect, it } from "vitest";
import {
	createRaigalCiWorkflow,
	createRaigalPackageScripts,
	maybeRunRaigal,
	resolveRaigalRunRequest,
	type RaigalRunRequest,
} from "../src/framework-adapters/core.js";
import raigalAstro, { createAstroRaigalScripts } from "../src/framework-adapters/astro.js";
import withRaigalExpo from "../src/framework-adapters/expo.js";
import { createRaigalNuxtModule } from "../src/framework-adapters/nuxt.js";
import raigalSvelteKit from "../src/framework-adapters/sveltekit.js";
import raigalVite from "../src/framework-adapters/vite.js";

const recordingRunner = (calls: RaigalRunRequest[]) => async (request: RaigalRunRequest) => {
	calls.push(request);
	return {
		command: request.bin,
		args: request.args,
		exitCode: 0,
		signal: null,
		skipped: false,
	};
};

describe("framework adapters", () => {
	it("resolves raigal command defaults without enabling execution", async () => {
		const request = resolveRaigalRunRequest("astro", { args: ["--changes"] });

		expect(request.bin).toBe("raigal");
		expect(request.args).toEqual(["ci", "--changes"]);

		const skipped = await maybeRunRaigal("astro", { args: ["--changes"] });
		expect(skipped).toMatchObject({
			command: "raigal",
			args: ["ci", "--changes"],
			exitCode: 0,
			skipped: true,
		});
	});

	it("generates package scripts and a workflow snippet", () => {
		expect(createRaigalPackageScripts("expo")).toMatchObject({
			"raigal:agent": "raigal agent",
			"raigal:ci": "raigal ci",
			"raigal:hook": "raigal hook install",
			"raigal:scan": "raigal scan",
			"aislop:agent": "raigal agent",
			"aislop:ci": "raigal ci",
			"aislop:hook": "raigal hook install",
			"aislop:scan": "raigal scan",
		});
		expect(createRaigalCiWorkflow()).toContain("npx --yes raigal@latest ci");
	});

	it("builds an Astro integration with opt-in build execution", async () => {
		const calls: RaigalRunRequest[] = [];
		const integration = raigalAstro({ enabled: true, runner: recordingRunner(calls) });

		expect(integration.name).toBe("@raigal/astro");
		expect(createAstroRaigalScripts()["raigal:ci"]).toBe("raigal ci");

		await integration.hooks["astro:build:start"]?.();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.framework).toBe("astro");
	});

	it("merges Expo config metadata without removing existing extra values", () => {
		const config = withRaigalExpo({ name: "mobile", extra: { apiUrl: "https://example.test" } });

		expect(config.extra?.apiUrl).toBe("https://example.test");
		expect(config.extra?.raigal).toEqual({
			command: "npx --yes raigal@latest ci",
			enabled: true,
			hook: "raigal hook install",
		});
		expect(config.extra?.aislop).toEqual({
			command: "npx --yes raigal@latest ci",
			enabled: true,
			hook: "raigal hook install",
		});
	});

	it("registers a Nuxt build hook and runs through the injected runner", async () => {
		const calls: RaigalRunRequest[] = [];
		let callback: (() => Promise<void>) | null = null;
		const module = createRaigalNuxtModule({ enabled: true, runner: recordingRunner(calls) });

		module.setup(
			{},
			{
				hook(name, cb) {
					expect(name).toBe("build:before");
					callback = cb;
				},
			},
		);

		await callback?.();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.framework).toBe("nuxt");
	});

	it("runs Vite and SvelteKit plugins through build hooks only when enabled", async () => {
		const calls: RaigalRunRequest[] = [];
		const vite = raigalVite({ enabled: true, runner: recordingRunner(calls), hook: "buildStart" });
		const svelte = raigalSvelteKit({ enabled: true, runner: recordingRunner(calls) });

		expect(vite.name).toBe("raigal:vite");
		expect(vite.apply).toBe("build");

		await vite.buildStart?.();
		await svelte.closeBundle?.();

		expect(calls.map((call) => call.framework)).toEqual(["vite", "sveltekit"]);
	});
});
