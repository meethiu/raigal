import type { Command } from "commander";
import { loginCommand } from "../commands/login.js";
import { logoutCommand } from "../commands/logout.js";
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
};
