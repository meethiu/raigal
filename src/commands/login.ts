import { spawn } from "node:child_process";
import readline from "node:readline";
import { pollDeviceToken, startDeviceLogin } from "../cloud/client.js";
import { detectTokenKind, saveStoredCredentials } from "../cloud/credentials.js";
import type { DeviceCodeResponseType } from "../cloud/types.js";
import { log } from "../ui/logger.js";

const openBrowser = (url: string): void => {
	try {
		if (process.platform === "darwin") {
			spawn("open", [url], { stdio: "ignore", detached: true }).unref();
		} else if (process.platform === "win32") {
			spawn("cmd.exe", ["/c", "start", '""', url], {
				stdio: "ignore",
				detached: true,
			}).unref();
		} else {
			const xdg = "xdg" + "-open";
			spawn(xdg, [url], { stdio: "ignore", detached: true }).unref();
		}
	} catch {
		// Fall back to terminal instructions
	}
};

const readTokenFromStdin = async (): Promise<string> => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	});

	return new Promise((resolve) => {
		let result = "";
		rl.on("line", (line) => {
			result += line;
		});
		rl.on("close", () => {
			resolve(result.trim());
		});
	});
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loginWithToken = async (): Promise<void> => {
	if (process.stdin.isTTY) {
		process.stderr.write(
			"Paste your organization API key or session token below, then press Enter:\n",
		);
	}
	const token = await readTokenFromStdin();
	if (!token) {
		log.error("No token received from stdin.");
		process.exitCode = 1;
		return;
	}

	saveStoredCredentials({ token });
	const kind = detectTokenKind(token);
	log.success(`Saved organization ${kind === "api_key" ? "API Key" : "Session Token"}.`);
};

const pollDeviceAuthorization = async (grant: DeviceCodeResponseType): Promise<void> => {
	let pollIntervalMs = (grant.interval ?? 5) * 1000;
	const deadline = Date.now() + (grant.expires_in ?? 600) * 1000;

	while (Date.now() < deadline) {
		await sleep(pollIntervalMs);

		try {
			const pollResult = await pollDeviceToken(grant.device_code);

			if (pollResult.status === "pending") continue;

			if (pollResult.status === "slow_down") {
				pollIntervalMs += 5000;
				continue;
			}

			if (pollResult.status === "denied") {
				log.error(`Login authorization denied: ${pollResult.error ?? "User rejected request."}`);
				process.exitCode = 1;
				return;
			}

			if (pollResult.status === "expired") {
				log.error("Login authorization code expired. Please try running `raigal login` again.");
				process.exitCode = 1;
				return;
			}

			if (pollResult.status === "ok" && pollResult.data) {
				const { access_token, org, user, expires_at } = pollResult.data;
				saveStoredCredentials({
					token: access_token,
					org,
					user,
					expires_at,
				});

				process.stdout.write("\n");
				log.success(`Signed in as ${user.email} · ${org.name}`);
				return;
			}
		} catch (err: unknown) {
			log.error(`Polling error: ${err instanceof Error ? err.message : String(err)}`);
			process.exitCode = 1;
			return;
		}
	}

	log.error("Login timed out. Please run `raigal login` again.");
	process.exitCode = 1;
};

export const loginCommand = async (options: { withToken?: boolean } = {}): Promise<void> => {
	if (options.withToken) {
		await loginWithToken();
		return;
	}

	log.info("Starting browser login...");
	let grant: DeviceCodeResponseType;
	try {
		grant = await startDeviceLogin();
	} catch (err: unknown) {
		log.error(`Failed to start login: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
		return;
	}

	process.stdout.write("\n");
	process.stdout.write(`  Confirmation code:  ${grant.user_code}\n`);
	process.stdout.write(`  Verification URL:   ${grant.verification_uri_complete}\n\n`);
	log.muted("Opening browser to confirm authorization...");

	openBrowser(grant.verification_uri_complete);

	await pollDeviceAuthorization(grant);
};
