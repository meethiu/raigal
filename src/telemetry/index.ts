export {
	flushTelemetry,
	getPostHogKey,
	getTelemetryStatus,
	isTelemetryDisabled,
	resetTelemetryForTests,
	type TelemetryStatus,
	track,
} from "./client.js";
export {
	buildHookScanCompletedProps,
	buildMcpToolCalledProps,
	type CommandName,
	type EngineCounts,
	errorKindFromException,
} from "./events.js";
export { ensureInstallId, resolveInstallIdPath } from "./identity.js";
export { withCommandLifecycle } from "./lifecycle.js";
