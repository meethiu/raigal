import { describe, expect, it } from "vitest";
import { renderCommandReference, renderHome, renderRootHelp } from "../../src/ui/home.js";
import { stripAnsi as strip } from "../helpers/ansi.js";

describe("home", () => {
	it("renders a compact command home screen", () => {
		const out = strip(renderHome({ version: "1.2.3" }));

		expect(out).toContain("raigal 1.2.3");
		expect(out).toContain("> raigal scan");
		expect(out).not.toContain("$ raigal scan");
		expect(out).toContain("raigal scan");
		expect(out).toContain("Score this project and show findings");
		expect(out).toContain("raigal agent");
		expect(out).toContain("raigal ci");
		expect(out).toContain("raigal hook install");
		expect(out).not.toContain("Usage:");
	});

	it("renders root help with usage, options, and one-off npx wording", () => {
		const out = strip(renderRootHelp({ version: "1.2.3" }));

		expect(out).toContain("Usage");
		expect(out).toContain("raigal scan [options] [directory]");
		expect(out).toContain("raigal agent [options] [directory]");
		expect(out).toContain("raigal ci [options] [directory]");
		expect(out).toContain("--changes");
		expect(out).toContain("--base");
		expect(out).toContain("--safe");
		expect(out).toContain("raigal agent providers");
		expect(out).toContain("raigal agent monitor show");
		expect(out).toContain("raigal hook status");
		expect(out).toContain(".raigalignore");
		expect(out).toContain("raigal commands");
		expect(out).toContain("raigal <cmd> --help");
		expect(out).toContain("npx raigal@latest scan");
		expect(out).toContain("Interactive");
		expect(out).toContain("> raigal");
		expect(out).toContain("raigal trends [options] [directory]");
		expect(out).toContain("raigal trends --limit 10");
		expect(out).toContain("Run raigal scan to scan your project");
		expect(out).not.toContain("Run npx raigal scan");
	});

	it("renders a full command reference", () => {
		const out = strip(renderCommandReference({ version: "1.2.3" }));

		expect(out).toContain("Commands");
		expect(out).toContain("Guide");
		expect(out).toContain("[directory] means a repo or path to scan");
		expect(out).toContain("Examples");
		expect(out).toContain("raigal trends --limit 10");
		expect(out).toContain("Flag guide");
		expect(out).toContain("Core workflow");
		expect(out).toContain("Local agent");
		expect(out).toContain("Project setup");
		expect(out).toContain("Hooks");
		expect(out).toContain("Reporting");
		expect(out).toContain("raigal [directory]");
		expect(out).toContain("raigal fix [directory]");
		expect(out).toContain("raigal agent [directory]");
		expect(out).toContain("raigal agent plan [directory]");
		expect(out).toContain("raigal agent providers");
		expect(out).toContain("raigal agent connect [provider]");
		expect(out).toContain("raigal agent use [provider]");
		expect(out).toContain("raigal agent switch [provider]");
		expect(out).toContain("raigal agent monitor [directory]");
		expect(out).toContain("raigal agent monitor list [directory]");
		expect(out).toContain("raigal agent monitor stop [monitor]");
		expect(out).toContain("raigal agent sessions [directory]");
		expect(out).toContain("raigal agent show [session]");
		expect(out).toContain("raigal agent apply [session]");
		expect(out).toContain("raigal agent watch [session]");
		expect(out).toContain("raigal agent stop [session]");
		expect(out).toContain("--provider <provider>");
		expect(out).toContain("--target-score <score>");
		expect(out).toContain("--max-turns <n>");
		expect(out).toContain("--commit-message <message>");
		expect(out).toContain("--base <ref>");
		expect(out).toContain("--dry-run");
		expect(out).toContain("--no-fix");
		expect(out).toContain("--background");
		expect(out).toContain("--safe");
		expect(out).toContain("-d, --verbose");
		expect(out).toContain("-f, --force");
		expect(out).toContain("-p, --prompt");
		expect(out).toContain("--deep-agents");
		expect(out).toContain("--crush");
		expect(out).toContain("raigal hook");
		expect(out).toContain("raigal hooks");
		expect(out).toContain("raigal hook uninstall [agents...]");
		expect(out).toContain("raigal hook baseline");
		expect(out).toContain("raigal install [agents...]");
		expect(out).toContain("raigal uninstall [agents...]");
		expect(out).toContain("--agent <names>");
		expect(out).toContain("--quality-gate");
		expect(out).toContain("--copilot");
		expect(out).toContain("raigal badge [directory]");
		expect(out).toContain("raigal trends [directory]");
		expect(out).toContain("--owner <owner>");
		expect(out).toContain("--limit <n>");
		expect(out).toContain("raigal version");
		expect(out).toContain(".raigalignore");
		expect(out).toContain("Run raigal <command> --help");
		expect(out).not.toContain("--all");

		const flagLines = out.split("\n").filter((line) => line.trimStart().startsWith("flags:"));
		expect(flagLines.length).toBeGreaterThan(0);
		expect(out.split("\n").every((line) => line.length <= 120)).toBe(true);

		const descriptionColumns = [
			["raigal", "Open the interactive menu"],
			["raigal scan [directory]", "Score code quality"],
			["raigal agent [directory]", "Create a local worktree"],
			["raigal hook install [agents...]", "Install coding-agent hooks"],
			["raigal badge [directory]", "Print score badge"],
		].map(([command, summary]) => {
			const line = out
				.split("\n")
				.find((candidate) => candidate.includes(command) && candidate.includes(summary));
			expect(line).toBeDefined();
			return line?.indexOf(summary) ?? -1;
		});
		expect(new Set(descriptionColumns).size).toBe(1);
		const summaryColumn = descriptionColumns[0];
		const firstFlagLine = flagLines.find((line) => line.includes("--changes"));
		expect(firstFlagLine).toBeDefined();
		const flagLabelColumn = firstFlagLine?.indexOf("flags:") ?? -1;
		const flagValueColumn = firstFlagLine?.indexOf("--changes") ?? -1;
		expect(flagLabelColumn).toBe(summaryColumn);
		expect(flagValueColumn).toBeGreaterThan(flagLabelColumn);
		const continuationLine = out
			.split("\n")
			.find((line) => line.includes("--format <format>") && !line.includes("flags:"));
		expect(continuationLine).toBeDefined();
		expect(continuationLine?.indexOf("--format <format>")).toBe(flagValueColumn);
	});
});
