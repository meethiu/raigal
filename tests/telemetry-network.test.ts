import http from "node:http";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	flushTelemetry,
	getTelemetryStatus,
	isTelemetryDisabled,
	resetTelemetryForTests,
	track,
} from "../src/telemetry/index.js";
import { APP_VERSION } from "../src/version.js";
import { telemetryShowCommand } from "../src/commands/telemetry-show.js";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("Task 7: Telemetry Network & Configuration", () => {
	const originalEnv = { ...process.env };
	let fetchSpy: ReturnType<typeof vi.fn>;
	let httpRequestSpy: ReturnType<typeof vi.spyOn>;
	let httpsRequestSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		resetTelemetryForTests();
		delete process.env.RAIGAL_POSTHOG_KEY;
		delete process.env.POSTHOG_KEY;
		delete process.env.RAIGAL_NO_TELEMETRY;
		delete process.env.AISLOP_NO_TELEMETRY;
		delete process.env.DO_NOT_TRACK;
		delete process.env.CI;

		fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
		vi.stubGlobal("fetch", fetchSpy);

		httpRequestSpy = vi.spyOn(http, "request").mockImplementation((() => {
			throw new Error("Outbound http.request is not permitted when telemetry is off");
		}) as any);

		httpsRequestSpy = vi.spyOn(https, "request").mockImplementation((() => {
			throw new Error("Outbound https.request is not permitted when telemetry is off");
		}) as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		process.env = { ...originalEnv };
		resetTelemetryForTests();
	});

	it("keeps telemetry off when no PostHog key is set: zero outbound requests", async () => {
		// No key is set
		track({
			event: "cli_command_completed",
			properties: { command: "scan" },
		});
		await flushTelemetry();

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(httpRequestSpy).not.toHaveBeenCalled();
		expect(httpsRequestSpy).not.toHaveBeenCalled();
	});

	it("renames aislop_version to cli_version in sent telemetry payload", async () => {
		process.env.RAIGAL_POSTHOG_KEY = "test_key_123";

		track({
			event: "cli_command_completed",
			properties: { command: "scan" },
		});
		await flushTelemetry();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
		expect(callBody.properties).toHaveProperty("cli_version", APP_VERSION);
		expect(callBody.properties).not.toHaveProperty("aislop_version");
	});

	it("respects opt-out variables: RAIGAL_NO_TELEMETRY, AISLOP_NO_TELEMETRY, DO_NOT_TRACK", async () => {
		process.env.RAIGAL_POSTHOG_KEY = "test_key_123";

		// RAIGAL_NO_TELEMETRY
		process.env.RAIGAL_NO_TELEMETRY = "1";
		expect(isTelemetryDisabled()).toBe(true);
		track({ event: "cli_command_completed" });
		await flushTelemetry();
		expect(fetchSpy).not.toHaveBeenCalled();
		delete process.env.RAIGAL_NO_TELEMETRY;

		// AISLOP_NO_TELEMETRY as read-only alias
		process.env.AISLOP_NO_TELEMETRY = "1";
		expect(isTelemetryDisabled()).toBe(true);
		track({ event: "cli_command_completed" });
		await flushTelemetry();
		expect(fetchSpy).not.toHaveBeenCalled();
		delete process.env.AISLOP_NO_TELEMETRY;

		// DO_NOT_TRACK
		process.env.DO_NOT_TRACK = "1";
		expect(isTelemetryDisabled()).toBe(true);
		track({ event: "cli_command_completed" });
		await flushTelemetry();
		expect(fetchSpy).not.toHaveBeenCalled();
		delete process.env.DO_NOT_TRACK;
	});

	it("raigal telemetry --show prints whether sending is enabled and exact event that would be sent", async () => {
		let output = "";
		const originalWrite = process.stdout.write;
		process.stdout.write = ((chunk: string | Uint8Array) => {
			output += String(chunk);
			return true;
		}) as typeof process.stdout.write;

		try {
			await telemetryShowCommand({ json: true });
			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty("enabled", false);
			expect(parsed).toHaveProperty("event");
			expect(parsed.event).toHaveProperty("properties");
			expect(parsed.event.properties).toHaveProperty("cli_version", APP_VERSION);
			expect(parsed.event.properties).not.toHaveProperty("aislop_version");
		} finally {
			process.stdout.write = originalWrite;
		}
	});

	it("CLI raigal telemetry --show outputs JSON with --json flag", () => {
		const res = spawnSync(process.execPath, [CLI_PATH, "telemetry", "--show", "--json"], {
			encoding: "utf-8",
			env: { ...process.env, CI: "1", NO_COLOR: "1" },
		});
		expect(res.status).toBe(0);
		expect(() => JSON.parse(res.stdout)).not.toThrow();
		const parsed = JSON.parse(res.stdout);
		expect(parsed).toHaveProperty("enabled");
		expect(parsed).toHaveProperty("event");
		expect(parsed.event.properties).toHaveProperty("cli_version", APP_VERSION);
	});
});
