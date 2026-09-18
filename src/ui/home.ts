import { APP_VERSION } from "../version.js";
import { highlightAislop, highlightRaigal } from "./brand.js";
import { renderHeader } from "./header.js";
import { terminalLink } from "./link.js";
import { renderHintLine } from "./logger.js";
import { style, theme } from "./theme.js";
import { padEnd } from "./width.js";

export { renderCommandReference } from "./command-reference.js";

interface HomeCommand {
	command: string;
	summary: string;
	group: "Run" | "Setup" | "Learn" | "Utility";
}

const HOME_COMMANDS: HomeCommand[] = [
	{ command: "raigal scan", summary: "Score this project and show findings", group: "Run" },
	{
		command: "raigal agent",
		summary: "Repair slop with your coding agent in an isolated worktree",
		group: "Run",
	},
	{
		command: "raigal fix",
		summary: "Auto-fix the mechanical issues deterministically",
		group: "Run",
	},
	{ command: "raigal ci", summary: "Run the quality gate for CI", group: "Run" },
	{ command: "raigal doctor", summary: "Check which engines can run here", group: "Run" },
	{ command: "raigal init", summary: "Create config and optional CI workflow", group: "Setup" },
	{
		command: "raigal hook install",
		summary: "Run Raigal after coding-agent edits",
		group: "Setup",
	},
	{ command: "raigal rules", summary: "Explain every rule and fix mode", group: "Learn" },
	{ command: "raigal trend", summary: "Show local score history", group: "Learn" },
	{
		command: "raigal badge",
		summary: "Print a score badge URL and README markdown",
		group: "Learn",
	},
	{ command: "raigal commands", summary: "List all commands and major flags", group: "Utility" },
	{ command: "raigal update", summary: "Check the latest npm version", group: "Learn" },
	{ command: "raigal version", summary: "Print the installed version", group: "Utility" },
];

const GROUPS: HomeCommand["group"][] = ["Run", "Setup", "Learn", "Utility"];
const COMMAND_PROMPT = ">";

interface HomeRenderInput {
	version?: string;
	includeHelpDetails?: boolean;
}

const renderCommandGroups = (): string => {
	const commandWidth = Math.max(...HOME_COMMANDS.map((c) => c.command.length));
	const lines: string[] = [];
	for (const group of GROUPS) {
		lines.push(` ${style(theme, "dim", group)}`);
		for (const item of HOME_COMMANDS.filter((c) => c.group === group)) {
			lines.push(
				`   ${style(theme, "muted", COMMAND_PROMPT)} ${highlightAislop(padEnd(item.command, commandWidth), theme)}  ${highlightAislop(item.summary, theme, "muted")}`,
			);
		}
		lines.push("");
	}
	return lines.join("\n");
};

const renderHelpDetails = (): string =>
	[
		` ${style(theme, "dim", "Usage")}`,
		"   raigal                         Open interactive menu",
		"   raigal scan [options] [directory]",
		"   raigal agent [options] [directory]",
		"   raigal fix [options] [directory]",
		"   raigal ci [options] [directory]",
		"   raigal init [options] [directory]",
		"   raigal doctor [directory]",
		"   raigal rules [directory]",
		"   raigal badge [options] [directory]",
		"   raigal trend [options] [directory]",
		"   raigal trends [options] [directory]",
		"   raigal hook [command]",
		"   raigal hook install [agents...]",
		"   raigal install hooks [agents...]",
		"   raigal update",
		"   raigal version",
		"",
		` ${style(theme, "dim", "Interactive")}`,
		"   > raigal                       open the menu",
		"   Scan                           Score this project and show findings",
		"   Agent                          Run a coding agent to repair slop",
		"   Fix                            Auto-fix the mechanical issues",
		"   Doctor                         Check installed engines and tools",
		"   Install hooks                  Run Raigal after agent edits",
		"",
		` ${style(theme, "dim", "Scan flags")}`,
		"   --changes        scan changed files from HEAD",
		"   --staged         scan staged files",
		"   --base           diff base for --changes",
		"   --json           emit machine-readable JSON",
		"   --sarif          emit SARIF 2.1.0",
		"   --format         choose json or sarif",
		"   --exclude        exclude comma-separated or repeated paths",
		"   --include        include comma-separated or repeated paths",
		"",
		` ${style(theme, "dim", "Fix flags")}`,
		"   --safe           only reversible fixes",
		"   --force          aggressive dependency and framework fixes",
		"   --prompt         print an agent handoff prompt",
		"   --codex          open Codex to fix remaining findings",
		"   --claude         open Claude Code to fix remaining findings",
		"",
		` ${style(theme, "dim", "Agent flags")}`,
		"   --provider       choose auto, codex, claude, or opencode",
		"   --target-score   score to converge toward",
		"   --in-place       edit the current worktree",
		"   --apply          apply the accepted diff back",
		"   --background     start locally and return immediately",
		"   --commit         commit the verified diff",
		"   --pr             push and open a draft pull request",
		"",
		` ${style(theme, "dim", "Agent commands")}`,
		"   raigal agent plan             preview provider, worktree, findings, and publish actions",
		"   raigal agent providers        show local provider status",
		"   raigal agent connect          connect Codex, Claude Code, or OpenCode locally",
		"   raigal agent use              set the repo-local default provider",
		"   raigal agent switch           alias for agent use",
		"   raigal agent monitor          watch git changes and stream scan cycles",
		"   raigal agent monitor list     list background monitors",
		"   raigal agent monitor show     show a background monitor",
		"   raigal agent monitor stop     stop a background monitor",
		"   raigal agent sessions         list local session transcripts",
		"   raigal agent show             show a session timeline and summary",
		"   raigal agent apply            apply a reviewed worktree session",
		"   raigal agent watch            stream session transcript updates",
		"   raigal agent stop             stop a background session",
		"",
		` ${style(theme, "dim", "Hook commands")}`,
		"   raigal hook                   manage coding-agent hooks",
		"   raigal hook install           install coding-agent hooks",
		"   raigal hook uninstall         remove coding-agent hooks",
		"   raigal hook status            show installed hooks",
		"   raigal hook baseline          capture the current score baseline",
		"   raigal install hooks          natural alias for hook install",
		"   raigal uninstall hooks        natural alias for hook uninstall",
		"",
		` ${style(theme, "dim", "Ignore and scope")}`,
		"   .raigalignore    skip generated, vendored, or noisy paths",
		"   .aislopignore    also supported for backward compatibility",
		"   .gitignore       respected for untracked files",
		"   --exclude        skip extra paths for this run",
		"   --include        scan only matching paths for this run",
		"",
		` ${style(theme, "dim", "More")}`,
		"   raigal commands        show every command and major flag",
		"   raigal <cmd> --help    show detailed help for one command",
		"   -h, --help             show help",
		"   -v, -V, --version      show version",
		"",
		` ${style(theme, "dim", "One-off latest run")}`,
		"   npx raigal@latest scan",
		"",
		` ${style(theme, "dim", "Examples")}`,
		"   raigal scan --changes",
		"   raigal fix --codex",
		"   raigal agent plan",
		"   raigal agent connect codex",
		"   raigal agent use codex",
		"   raigal agent monitor --once",
		"   raigal agent monitor --background",
		"   raigal agent monitor list",
		"   raigal agent --provider codex",
		"   raigal agent sessions",
		"   raigal agent show",
		"   raigal agent apply",
		"   raigal agent watch",
		"   raigal agent stop",
		"   raigal agent --provider claude --pr",
		"   raigal hook install --claude",
		"   raigal install hooks",
		"   raigal rules --search",
		"   raigal trends --limit 10",
		"",
	]
		.map((line) => highlightRaigal(line, theme))
		.join("\n");

export const renderHome = (input: HomeRenderInput = {}): string => {
	const version = input.version ?? APP_VERSION;
	let out = renderHeader({ version, command: "--bare", context: [] });
	out += `${renderCommandGroups().trimEnd()}\n`;
	out += `\n ${style(theme, "dim", "Team platform")}\n   ${style(theme, "muted", "Gate every PR and share one standard across your team")}  ${style(theme, "accent", terminalLink("https://raigal.dev"))}\n`;
	if (input.includeHelpDetails) {
		out += `\n${renderHelpDetails().trimEnd()}\n`;
		out += renderHintLine("Run raigal scan to scan your project");
	}
	return out;
};

export const renderRootHelp = (input: { version?: string } = {}): string =>
	`${renderHome({ version: input.version, includeHelpDetails: true })}\n`;
