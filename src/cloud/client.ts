import { APP_VERSION } from "../version.js";
import { DeviceCodeResponse, DeviceTokenResponse, EntitlementResponse } from "./contract.js";
import type {
	DeviceCodeResponseType,
	DeviceTokenResponseType,
	EntitlementResponseType,
} from "./types.js";

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

const getApiBaseUrl = (): string =>
	process.env.RAIGAL_API_URL?.trim().replace(/\/+$/, "") || "https://app.raigal.dev";

interface RequestOptions {
	method?: "GET" | "POST";
	token?: string;
	oidcToken?: string;
	body?: unknown;
	timeoutMs?: number;
}

export const requestApi = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
	const url = `${getApiBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
	const headers: Record<string, string> = {
		"X-Raigal-Client": `raigal-cli/${APP_VERSION}`,
		Accept: "application/json",
	};

	if (options.token) {
		headers.Authorization = `Bearer ${options.token}`;
	}

	if (options.oidcToken) {
		headers["X-GitHub-OIDC"] = options.oidcToken;
	}

	let body: string | undefined;
	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(options.body);
	}

	const timeout = options.timeoutMs ?? 5000;
	let response: Response;
	try {
		response = await fetch(url, {
			method: options.method ?? (body ? "POST" : "GET"),
			headers,
			body,
			signal: AbortSignal.timeout(timeout),
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		throw new ApiError(`Network request failed: ${message}`, 0, "network_error");
	}

	const text = await response.text();
	let json: unknown;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { error: { message: text } };
	}

	if (!response.ok) {
		const errorObj = (json as { error?: { code?: string; message?: string } })?.error;
		const code = errorObj?.code || (json as { error?: string })?.error;
		const message = errorObj?.message || (typeof json === "object" ? JSON.stringify(json) : text);
		throw new ApiError(
			message || `Request failed with status ${response.status}`,
			response.status,
			code,
		);
	}

	return json as T;
};

export const startDeviceLogin = async (): Promise<DeviceCodeResponseType> => {
	const data = await requestApi<unknown>("/v1/device/code", { method: "POST" });
	return DeviceCodeResponse.parse(data);
};

export interface DeviceTokenPollResult {
	status: "ok" | "pending" | "slow_down" | "denied" | "expired";
	data?: DeviceTokenResponseType;
	error?: string;
}

export const pollDeviceToken = async (deviceCode: string): Promise<DeviceTokenPollResult> => {
	try {
		const data = await requestApi<unknown>("/v1/device/token", {
			method: "POST",
			body: { device_code: deviceCode },
		});
		return { status: "ok", data: DeviceTokenResponse.parse(data) };
	} catch (err) {
		if (err instanceof ApiError && err.status === 400) {
			if (err.code === "authorization_pending") return { status: "pending" };
			if (err.code === "slow_down") return { status: "slow_down" };
			if (err.code === "access_denied") return { status: "denied", error: err.message };
			if (err.code === "expired_token") return { status: "expired", error: err.message };
		}
		throw err;
	}
};

export const fetchEntitlementFromApi = async (
	token?: string,
	oidcToken?: string,
): Promise<EntitlementResponseType> => {
	const data = await requestApi<unknown>("/v1/entitlement", {
		method: "POST",
		token: token || undefined,
		oidcToken,
	});
	return EntitlementResponse.parse(data);
};

export const revokeSessionApi = async (token: string): Promise<void> => {
	try {
		await requestApi("/v1/logout", { method: "POST", token, timeoutMs: 3000 });
	} catch {
		/* best effort */
	}
};
