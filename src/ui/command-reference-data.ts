import type { DisplayRow } from "./display.js";

export interface CommandReference {
	command: string;
	summary: string;
	flags?: string[];
}

const SCAN_FLAGS = [
	"--changes",
	"--staged",
	"--base <ref>",
	"-d, --verbose",
	"--json",
	"--sarif",
	"--format <format>",
	"--include <patterns>",
	"--exclude <patterns>",
];

const FIX_AGENT_FLAGS = [
	"--claude",
	"--codex",
	"--cursor",
	"--windsurf",
	"--vscode",
	"--amp",
	"--antigravity",
	"--deep-agents",
	"--gemini",
	"--kimi",
	"--opencode",
	"--warp",
	"--aider",
	"--goose",
	"--pi",
	"--crush",
];

const FIX_FLAGS = [
	"-d, --verbose",
	"-f, --force",
	"--safe",
	"--dry-run",
	"--changes",
	"--staged",
	"--base <ref>",
	"-p, --prompt",
	...FIX_AGENT_FLAGS,
];

const AGENT_FLAGS = [
	"--provider <provider>",
	"--target-score <score>",
	"--max-turns <n>",
	"--limit <n>",
	"--in-place",
	"--apply",
	"-y, --yes",
	"--dry-run",
	"--background",
	"--no-fix",
	"--commit",
	"--pr",
	"--branch <name>",
	"--base <branch>",
	"--commit-message <message>",
	"--title <title>",
	"--ready",
	"--no-keep-worktree",
	"--cleanup",
];

const AGENT_MONITOR_FLAGS = [
	"--provider <provider>",
	"--target-score <score>",
	"--max-turns <n>",
	"--limit <n>",
	"--in-place",
	"--dry-run",
	"--no-fix",
	"--repair",
	"--background",
	"--interval <ms>",
	"--debounce <ms>",
	"--once",
];

const CI_FLAGS = [
	"--changes",
	"--staged",
	"--base <ref>",
	"--human",
	"--sarif",
	"--format <format>",
];

const HOOK_INSTALL_FLAGS = [
	"--agent <names>",
	"-g, --global",
	"--project",
	"--dry-run",
	"--yes",
	"--quality-gate",
	"--claude",
	"--cursor",
	"--gemini",
	"--pi",
	"--codex",
	"--windsurf",
	"--cline",
	"--kilocode",
	"--antigravity",
	"--copilot",
];

const HOOK_UNINSTALL_FLAGS = [
	"--agent <names>",
	"-g, --global",
	"--project",
	"--dry-run",
	"--claude",
	"--cursor",
	"--gemini",
	"--pi",
	"--codex",
	"--windsurf",
	"--cline",
	"--kilocode",
	"--antigravity",
	"--copilot",
];

export const COMMAND_REFERENCE: CommandReference[] = [
	{
		command: "raigal [directory]",
		summary: "Open the interactive menu, or scan the current directory in non-TTY shells",
		flags: SCAN_FLAGS,
	},
	{
		command: "raigal scan [directory]",
		summary: "Score code quality and show findings",
		flags: SCAN_FLAGS,
	},
	{
		command: "raigal agent [directory]",
		summary: "Create a local worktree, stream a provider repair session, verify, and summarize",
		flags: AGENT_FLAGS,
	},
	{
		command: "raigal fix [directory]",
		summary: "Apply deterministic auto-fixes, or hand remaining findings to an agent",
		flags: FIX_FLAGS,
	},
	{
		command: "raigal agent plan [directory]",
		summary: "Preview provider, worktree, findings, and publish actions without editing",
		flags: AGENT_FLAGS,
	},
	{
		command: "raigal agent providers",
		summary: "Show installed local provider status and setup hints",
	},
	{
		command: "raigal agent connect [provider]",
		summary: "Run the selected provider's local CLI login flow",
		flags: ["--dry-run"],
	},
	{
		command: "raigal agent use [provider]",
		summary: "Set or show the repo-local default repair provider",
		flags: ["--root <directory>", "--dry-run"],
	},
	{
		command: "raigal agent switch [provider]",
		summary: "Alias for agent use",
		flags: ["--root <directory>", "--dry-run"],
	},
	{
		command: "raigal agent monitor [directory]",
		summary: "Watch git changes and stream scan or repair cycles",
		flags: AGENT_MONITOR_FLAGS,
	},
	{
		command: "raigal agent monitor list [directory]",
		summary: "List local background agent monitors",
		flags: ["--limit <n>"],
	},
	{
		command: "raigal agent monitor show [monitor]",
		summary: "Show a background agent monitor record",
		flags: ["--root <directory>"],
	},
	{
		command: "raigal agent monitor stop [monitor]",
		summary: "Stop a running background agent monitor",
		flags: ["--root <directory>", "--force"],
	},
	{
		command: "raigal agent sessions [directory]",
		summary: "List recent local agent sessions",
		flags: ["--limit <n>"],
	},
	{
		command: "raigal agent show [session]",
		summary: "Show a local agent session summary and timeline",
		flags: ["--root <directory>"],
	},
	{
		command: "raigal agent apply [session]",
		summary: "Apply a reviewed isolated worktree session back to the repo",
		flags: ["--root <directory>", "--dry-run", "-y, --yes"],
	},
	{
		command: "raigal agent watch [session]",
		summary: "Watch a local agent session as it streams",
		flags: ["--root <directory>", "--interval <ms>", "--once"],
	},
	{
		command: "raigal agent stop [session]",
		summary: "Stop a running background agent session",
		flags: ["--root <directory>", "--force"],
	},
	{
		command: "raigal ci [directory]",
		summary: "Run the CI quality gate with thresholded exit codes",
		flags: CI_FLAGS,
	},
	{
		command: "raigal init [directory]",
		summary: "Create config, rules, and optional GitHub Actions workflow",
		flags: ["--strict"],
	},
	{ command: "raigal doctor [directory]", summary: "Check installed engines and project coverage" },
	{
		command: "raigal rules [directory]",
		summary: "Explain rule IDs, severity, fixability, and meaning",
		flags: ["--search"],
	},
	{ command: "raigal hook", summary: "Manage per-edit coding-agent hooks" },
	{
		command: "raigal hook install [agents...]",
		summary: "Install coding-agent hooks",
		flags: HOOK_INSTALL_FLAGS,
	},
	{
		command: "raigal hook uninstall [agents...]",
		summary: "Remove installed coding-agent hooks",
		flags: HOOK_UNINSTALL_FLAGS,
	},
	{ command: "raigal hooks", summary: "Alias for hook" },
	{ command: "raigal hook status", summary: "Show installed hook status" },
	{ command: "raigal hook baseline", summary: "Capture the current score as the hook baseline" },
	{
		command: "raigal install [agents...]",
		summary: "Alias for hook install",
		flags: HOOK_INSTALL_FLAGS,
	},
	{
		command: "raigal install hooks [agents...]",
		summary: "Natural alias for install; same flags",
		flags: HOOK_INSTALL_FLAGS,
	},
	{
		command: "raigal uninstall [agents...]",
		summary: "Alias for hook uninstall",
		flags: HOOK_UNINSTALL_FLAGS,
	},
	{
		command: "raigal uninstall hooks [agents...]",
		summary: "Natural alias for uninstall; same flags",
		flags: HOOK_UNINSTALL_FLAGS,
	},
	{
		command: "raigal badge [directory]",
		summary: "Print score badge URL and README markdown",
		flags: ["--owner <owner>", "--repo <repo>", "--json"],
	},
	{
		command: "raigal trend [directory]",
		summary: "Show recent local scores from .raigal/history.jsonl",
		flags: ["--limit <n>"],
	},
	{ command: "raigal trends [directory]", summary: "Alias for trend", flags: ["--limit <n>"] },
	{ command: "raigal update", summary: "Show current and latest npm versions" },
	{ command: "raigal upgrade", summary: "Alias for update" },
	{ command: "raigal version", summary: "Print the installed version" },
	{ command: "raigal commands", summary: "Show this command reference" },
];

export const GUIDE_ROWS: DisplayRow[] = [
	{ label: "Use", value: "raigal commands is the full public command list with major flags." },
	{
		label: "Directory",
		value: "[directory] means a repo or path to scan; omit it for the current directory.",
	},
	{ label: "Help", value: "run raigal <command> --help for complete command-specific options." },
	{ label: "Aliases", value: "natural aliases are listed when they are public entry points." },
];

export const EXAMPLE_ROWS: DisplayRow[] = [
	{ label: "Scan", value: "raigal scan --changes" },
	{ label: "Fix", value: "raigal fix --safe" },
	{ label: "Agent", value: "raigal agent plan" },
	{ label: "Hooks", value: "raigal hook status" },
	{ label: "Trend", value: "raigal trends --limit 10" },
];

export const FLAG_GUIDE_ROWS: DisplayRow[] = [
	{ label: "--changes", value: "scan or gate files changed from HEAD or --base" },
	{ label: "--staged", value: "scan or gate staged files" },
	{ label: "--json", value: "emit machine-readable scan output" },
	{ label: "--sarif", value: "emit SARIF for code scanning" },
	{ label: "--safe", value: "only apply reversible fixes" },
	{ label: "--provider", value: "choose auto, codex, claude, or opencode for local agent runs" },
	{ label: "--dry-run", value: "preview the action without writing changes" },
];
