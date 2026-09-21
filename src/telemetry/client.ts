import os from "node:os";
import { APP_VERSION } from "../version.js";
import { detectInstallChannel, isCiEnv } from "./env.js";
import { ensureInstallId, resolveInstallIdPath } from "./identity.js";
import { redactProperties } from "./redaction.js";

export const getPostHogHost = (): string =>
	process.env.RAIGAL_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";

export const getPostHogKey = (): string =>
	process.env.RAIGAL_POSTHOG_KEY ?? process.env.POSTHOG_KEY ?? "";

const SCHEMA_VERSION = "v2";
const REQUEST_TIMEOUT_MS = 3000;

export type EventName =
	| "cli_installed"
	| "cli_command_started"
	| "cli_command_completed"
	| "mcp_server_started"
	| "mcp_tool_called"
	| "hook_scan_completed";

export interface TelemetryConfig {
	enabled?: boolean;
}

const isOptedOut = (val?: string): boolean => val === "1" || val?.toLowerCase() === "true";

export const isTelemetryDisabled = (config?: TelemetryConfig): boolean => {
	const env = process.env;
	if (
		isOptedOut(env.RAIGAL_NO_TELEMETRY) ||
		isOptedOut(env.AISLOP_NO_TELEMETRY) ||
		isOptedOut(env.DO_NOT_TRACK)
	)
		return true;
	if (config?.enabled === false) return true;
	if (config?.enabled === true) return false;
	if (env.CI === "true" || env.CI === "1") return true;
	return false;
};

const isDebug = (): boolean =>
	process.env.RAIGAL_TELEMETRY_DEBUG === "1" || process.env.AISLOP_TELEMETRY_DEBUG === "1";

const pendingRequests = new Set<Promise<unknown>>();
let cachedInstallId: string | null = null;
let installCreated = false;

export const baseProperties = (installId: string): Record<string, unknown> => ({
	cli_version: APP_VERSION,
	node_version: process.version,
	os: os.platform(),
	arch: os.arch(),
	schema_version: SCHEMA_VERSION,
	anonymous_install_id: installId,
	package_manager: detectInstallChannel(),
	is_ci: isCiEnv(),
});

interface TrackInput {
	event: EventName;
	properties?: Record<string, unknown>;
	config?: TelemetryConfig;
}

interface TrackResult {
	installCreated: boolean;
}

export const track = (input: TrackInput): TrackResult => {
	const key = getPostHogKey().trim();
	if (!key || isTelemetryDisabled(input.config)) return { installCreated: false };

	if (cachedInstallId == null) {
		const ensured = ensureInstallId(resolveInstallIdPath());
		cachedInstallId = ensured.installId;
		installCreated = ensured.created;
	}

	const merged = { ...baseProperties(cachedInstallId), ...input.properties };
	const { clean, dropped } = redactProperties(merged);

	if (isDebug()) {
		const compact = JSON.stringify({ event: input.event, properties: clean });
		process.stderr.write(`[telemetry] ${compact}\n`);
		if (dropped.length > 0) {
			for (const prop of dropped) {
				process.stderr.write(`[telemetry] dropped non-allowlisted property: ${prop}\n`);
			}
		}
	}

	if (
		process.env.RAIGAL_TELEMETRY_DRY_RUN === "1" ||
		process.env.AISLOP_TELEMETRY_DRY_RUN === "1"
	) {
		return { installCreated };
	}

	const payload = {
		api_key: key,
		event: input.event,
		distinct_id: cachedInstallId,
		properties: clean,
		timestamp: new Date().toISOString(),
	};

	const request = fetch(`${getPostHogHost()}/capture/`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
		.then(() => {})
		.catch(() => {})
		.finally(() => {
			pendingRequests.delete(request);
		});

	pendingRequests.add(request);
	return { installCreated };
};

export const flushTelemetry = async (timeoutMs?: number): Promise<void> => {
	if (pendingRequests.size === 0) return;
	const all = Promise.all(pendingRequests);
	if (timeoutMs == null) {
		await all;
		return;
	}
	await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
};

export const resetTelemetryForTests = (): void => {
	cachedInstallId = null;
	installCreated = false;
	pendingRequests.clear();
};

export interface TelemetryStatus {
	enabled: boolean;
	event: {
		event: EventName;
		distinct_id: string;
		properties: Record<string, unknown>;
	};
	reason: string;
}

export const getTelemetryStatus = (config?: TelemetryConfig): TelemetryStatus => {
	const disabled = isTelemetryDisabled(config);
	const key = getPostHogKey().trim();
	const enabled = !disabled && Boolean(key);

	if (cachedInstallId == null) {
		const ensured = ensureInstallId(resolveInstallIdPath());
		cachedInstallId = ensured.installId;
		installCreated = ensured.created;
	}

	const sampleProperties = redactProperties({
		...baseProperties(cachedInstallId),
		command: "scan",
	}).clean;

	const sampleEvent = {
		event: "cli_command_completed" as EventName,
		distinct_id: cachedInstallId,
		properties: sampleProperties,
	};

	let reason = "Telemetry sending is enabled";
	if (disabled) {
		reason = "Telemetry is disabled by opt-out variable, CI, or config";
	} else if (!key) {
		reason = "Telemetry is off: no PostHog API key is set";
	}

	return {
		enabled,
		event: sampleEvent,
		reason,
	};
};
