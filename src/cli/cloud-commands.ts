import type { Command } from "commander";
import { loginCommand } from "../commands/login.js";
import { logoutCommand } from "../commands/logout.js";
import { telemetryShowCommand } from "../commands/telemetry-show.js";
import { whoamiCommand } from "../commands/whoami.js";

export const registerCloudCommands = (program: Command): void => {
	program
		.command("login")
		.description("Sign in to your Raigal organization")
		.option("--with-token", "read an organization API key from stdin")
		.action(async (flags: { withToken?: boolean }) => {
			await loginCommand(flags);
		});

	program
		.command("logout")
		.description("Sign out and clear local credentials and cached entitlement")
		.action(async () => {
			await logoutCommand();
		});

	program
		.command("whoami")
		.description("Display your current organization, user, plan, and allowed GitHub owners")
		.action(async () => {
			await whoamiCommand();
		});

	program
		.command("telemetry")
		.description("Inspect recorded cloud run payloads and outbox status")
		.option("--show", "display the last recorded cloud run payload and outbox status")
		.option("--json", "output in JSON format")
		.action(async (flags: { show?: boolean; json?: boolean }) => {
			const isJson = Boolean(flags?.json || process.argv.includes("--json"));
			if (flags.show || isJson) {
				await telemetryShowCommand({ json: isJson });
			} else {
				process.stdout.write(
					"Run `raigal telemetry --show` to inspect recorded telemetry payloads.\n",
				);
			}
		});
};
