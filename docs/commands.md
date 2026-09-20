# Commands

Use `raigal --help` for the short overview, `raigal commands` for the full public command list, and `raigal <command> --help` for command-specific help. (`raigal` is accepted as a command alias for backwards compatibility).

For one-off latest runs without installing, prefix commands with `npx raigal@latest`, for example:

```bash
npx raigal@latest scan
```

## Overview

| Command | What it does |
|---|---|
| `raigal [directory]` | Interactive TTY menu, or scan current directory in non-TTY shells |
| `raigal scan [directory]` | Score code quality and show findings |
| `raigal agent [directory]` | Run a local worktree repair session with Codex, Claude Code, or OpenCode |
| `raigal fix [directory]` | Apply deterministic auto-fixes, or hand remaining findings to an agent |
| `raigal agent plan [directory]` | Preview provider, worktree, findings, and publish actions |
| `raigal agent providers` | Show installed local provider status and setup hints |
| `raigal agent connect [provider]` | Run a provider's local CLI login flow |
| `raigal agent use [provider]` | Set or show the repo-local default repair provider |
| `raigal agent switch [provider]` | Alias for `raigal agent use` |
| `raigal agent monitor [directory]` | Watch git changes and stream scan or repair cycles |
| `raigal agent monitor list [directory]` | List local background agent monitors |
| `raigal agent monitor show [monitor]` | Show a background monitor record |
| `raigal agent monitor stop [monitor]` | Stop a running background monitor |
| `raigal agent sessions [directory]` | List recent local agent sessions |
| `raigal agent show [session]` | Show a session summary and timeline |
| `raigal agent apply [session]` | Apply a reviewed isolated worktree session back to the repo |
| `raigal agent watch [session]` | Stream a local session transcript |
| `raigal agent stop [session]` | Stop a running background session |
| `raigal ci [directory]` | Run the CI quality gate with thresholded exit codes |
| `raigal init [directory]` | Create `.raigal/config.yml`, `.raigal/rules.yml`, and optional workflow |
| `raigal doctor [directory]` | Check installed engines and project coverage |
| `raigal rules [directory]` | Explain rule IDs, severity, fixability, score impact, and meaning |
| `raigal hook` | Manage per-edit coding-agent hooks |
| `raigal hook install [agents...]` | Install coding-agent hooks |
| `raigal hook uninstall [agents...]` | Remove coding-agent hooks |
| `raigal hooks` | Alias for `raigal hook` |
| `raigal hook status` | Show installed hook status |
| `raigal hook baseline` | Capture the current score as the hook baseline |
| `raigal install [agents...]` | Alias for `raigal hook install` |
| `raigal install hooks [agents...]` | Natural alias for `raigal hook install` |
| `raigal uninstall [agents...]` | Alias for `raigal hook uninstall` |
| `raigal uninstall hooks [agents...]` | Natural alias for `raigal hook uninstall` |
| `raigal badge [directory]` | Print score badge URL and README markdown |
| `raigal trend [directory]` | Show recent scores from `.raigal/history.jsonl` |
| `raigal trends [directory]` | Alias for `raigal trend` |
| `raigal update` | Show current and latest npm versions |
| `raigal upgrade` | Alias for `raigal update` |
| `raigal version` | Print the installed version |
| `raigal commands` | Show the full command reference |

`raigal hooks` is an alias for `raigal hook`. `raigal install hooks ...` and `raigal uninstall hooks ...` are accepted natural aliases for hook install and uninstall.

## Flags

### scan

| Flag | Description |
|---|---|
| `--changes` | Only scan changed files (defaults to diffing `HEAD`) |
| `--base <ref>` | Diff base for `--changes`, e.g. `origin/main` (default `HEAD`) |
| `--staged` | Only scan staged files |
| `-d, --verbose` | Show detailed per-file output |
| `--json` | Output JSON instead of terminal UI |
| `--sarif` | Output SARIF 2.1.0 |
| `--format <format>` | Output format: `json` or `sarif` |
| `--include <patterns>` | Only scan matching comma-separated or repeated paths |
| `--exclude <patterns>` | Exclude comma-separated or repeated paths |

### ci

| Flag | Description |
|---|---|
| `--changes` | Only gate changed files (defaults to diffing `HEAD`) |
| `--base <ref>` | Diff base for `--changes`, e.g. `origin/main` (default `HEAD`) |
| `--staged` | Only gate staged files |
| `--human` | Render the human-friendly scan UI instead of JSON |
| `--sarif` | Output SARIF 2.1.0 |
| `--format <format>` | Output format: `json` or `sarif` |

Use `--changes --base origin/<target>` to gate a pull request on only the files it touches. See [CI / CD](ci.md) for per-provider recipes (GitHub Actions, GitLab, CircleCI, Bitbucket Pipelines).

### fix

| Flag | Description |
|---|---|
| `-d, --verbose` | Show detailed fix progress |
| `-f, --force` | Run aggressive fixes: dependency audit, framework alignment, unused file removal |
| `--safe` | Only apply reversible fixes |
| `--dry-run` | Print planned fix steps, eligible findings, and skipped steps without writing files |
| `--changes` | Only fix changed files (defaults to diffing `HEAD`) |
| `--base <ref>` | Diff base for `--changes`, e.g. `origin/main` (default `HEAD`) |
| `--staged` | Only fix staged files |
| `-p, --prompt` | Print an agent-ready prompt for remaining issues |

Agent handoff flags: `--claude`, `--codex`, `--cursor`, `--windsurf`, `--vscode`, `--amp`, `--antigravity`, `--deep-agents`, `--gemini`, `--kimi`, `--opencode`, `--warp`, `--aider`, `--goose`, `--pi`, `--crush`.

### agent

`raigal agent` is the local-first repair loop. It creates an isolated git worktree by default, runs safe deterministic fixes, streams a headless provider session, verifies with `raigal scan --json`, writes a JSONL session transcript, and leaves the worktree for review unless you apply or publish the diff.

Provider auth stays with the provider CLI you already use:

```bash
raigal agent providers          # inspect local provider status
raigal agent connect codex      # runs codex login
raigal agent connect claude     # runs claude auth login
raigal agent connect opencode   # runs opencode auth login
raigal agent use claude         # save a repo-local default provider
raigal agent use auto           # clear the saved default and auto-detect
raigal agent plan               # preview the local run without editing
raigal agent monitor            # stream scans when git changes settle
raigal agent monitor --background
raigal agent monitor list       # list background monitors
raigal agent monitor show       # inspect latest monitor record
raigal agent monitor stop       # stop latest background monitor
raigal agent monitor --repair --in-place
raigal agent --provider claude  # switch repair provider for this run
raigal agent sessions           # list local transcripts
raigal agent show               # show the latest timeline and summary
raigal agent apply              # apply a reviewed worktree session later
raigal agent watch              # stream transcript updates
raigal agent stop               # stop a running background session
```

| Flag | Description |
|---|---|
| `--provider <provider>` | Provider to use: `auto`, `codex`, `claude`, or `opencode` |
| `--target-score <score>` | Score to converge toward |
| `--max-turns <n>` | Maximum provider turns for one repair attempt |
| `--limit <n>` | Maximum findings to hand to the provider |
| `--in-place` | Edit the current worktree instead of creating an isolated worktree |
| `--apply` | Apply the accepted diff back to the original worktree |
| `-y, --yes` | Skip confirmation prompts for `--apply` |
| `--dry-run` | Print the selected provider and plan without running it |
| `--background` | Start the local agent session in a detached background process |
| `--no-fix` | Skip deterministic safe fixes before provider handoff |
| `--commit` | Commit the verified diff on an agent branch |
| `--pr` | Push the agent branch and open a draft pull request |
| `--branch <name>` | Branch name for `--commit` or `--pr` |
| `--base <branch>` | Base branch for `--pr` |
| `--commit-message <message>` | Commit message for `--commit` or `--pr` |
| `--title <title>` | Pull request title for `--pr` |
| `--ready` | Open a ready-for-review PR instead of a draft |
| `--no-keep-worktree` | Remove the generated worktree when it is safe to do so |
| `--cleanup` | Remove the generated worktree even when a diff remains |

Use `raigal agent use <provider>` to save a repo-local default provider under `.raigal/agent/provider.json`; this file is added to the local Git exclude and is not a tracked project config. `--provider <provider>` still overrides the saved default for one run, and `--provider auto` forces auto-detection.

Use `raigal agent plan` with the same flags before running the agent to preview the selected provider, provider source, git worktree mode, current score, findings handed to the provider, apply behavior, commit message, and PR mode. It also reports blockers such as an unauthenticated provider, dirty checkout in isolated worktree mode, or `--background --apply` without `--yes`.

Session transcripts are stored under `.raigal/agent/sessions/`. Agent sessions and worktrees are added to the repo's local `.git/info/exclude`, so local agent state stays out of commits without editing project `.gitignore`. Provider JSONL is normalized for the terminal stream while raw output remains in the transcript for audit.

Background runs return immediately with a session id, transcript path, and log path. Use `raigal agent show <session>` to inspect progress. `--apply --background` requires `--yes` because a detached run cannot prompt.

For isolated worktree sessions, use `raigal agent apply <session>` after review to apply the verified diff back to the original repo. Add `--dry-run` to preview the files first, or `--yes` to skip the confirmation prompt.

Monitor mode:

| Command | Description |
|---|---|
| `raigal agent monitor [directory] --once` | Run one local monitor scan cycle and exit |
| `raigal agent monitor [directory] --interval <ms> --debounce <ms>` | Poll git status and react after changes settle |
| `raigal agent monitor [directory] --repair --in-place` | Run bounded local repair sessions when scans miss the target |
| `raigal agent monitor [directory] --background` | Start a detached local monitor and return the monitor id, record path, and log path |
| `raigal agent monitor list [directory] --limit <n>` | List recent background monitor records with latest score summary |
| `raigal agent monitor show [monitor] --root <directory>` | Show one background monitor's status, log path, and recent scan cycles |
| `raigal agent monitor stop [monitor] --root <directory> --force` | Stop a background monitor, using `SIGKILL` with `--force` |

By default, monitor mode scans and reports only. Automatic edits require both `--repair` and `--in-place`, because the monitor reacts to the checkout the developer is actively editing. Background monitor records keep a compact recent cycle history: timestamp, score, finding count, changed files, and whether a repair session was triggered.

Session review commands:

| Command | Description |
|---|---|
| `raigal agent use [provider] --root <directory> --dry-run` | Set, clear, or show the repo-local default repair provider |
| `raigal agent sessions [directory] --limit <n>` | List recent local sessions |
| `raigal agent show [session] --root <directory>` | Show one session's review summary, timeline, selected findings, changed files, and recent provider output |
| `raigal agent apply [session] --root <directory> --dry-run` | Preview or apply a reviewed isolated worktree diff back to the repo |
| `raigal agent watch [session] --root <directory> --interval <ms>` | Follow a session transcript until completion and print the terminal review summary |
| `raigal agent stop [session] --root <directory> --force` | Stop a running background session, using `SIGKILL` with `--force` |

### hook install

| Flag | Description |
|---|---|
| `--agent <names>` | Comma-separated agent list |
| `-g, --global` | Install to user-scope config |
| `--project` | Install to project-scope config |
| `--dry-run` | Print the planned diff without writing |
| `--yes` | Skip confirmation prompt |
| `--quality-gate` | Add a Claude Stop hook that blocks score regressions |

Agent shortcut flags: `--claude`, `--cursor`, `--gemini`, `--pi`, `--codex`, `--windsurf`, `--cline`, `--kilocode`, `--antigravity`, `--copilot`.

### hook uninstall

| Flag | Description |
|---|---|
| `--agent <names>` | Comma-separated agent list |
| `-g, --global` | Uninstall from user-scope config |
| `--project` | Uninstall from project-scope config |
| `--dry-run` | Print the planned removal without writing |

Agent shortcut flags: `--claude`, `--cursor`, `--gemini`, `--pi`, `--codex`, `--windsurf`, `--cline`, `--kilocode`, `--antigravity`, `--copilot`.

### Other command flags

| Command | Flags |
|---|---|
| `raigal ci` | `--changes`, `--staged`, `--base <ref>`, `--human`, `--sarif`, `--format <format>` |
| `raigal init` | `--strict` |
| `raigal rules` | `--search` |
| `raigal badge` | `--owner <owner>`, `--repo <repo>`, `--json` |
| `raigal trend` | `--limit <n>` |
| `raigal trends` | `--limit <n>` |
| Global | `-h, --help`, `-v, --version`, `-V` |

## Ignore and Scope

`node_modules`, `.git`, `dist`, `build`, and `coverage` are excluded by default.

Add project-wide ignore rules in `.raigalignore`:

```gitignore
src/generated
**/*.snap
legacy
```

Use `--include` and `--exclude` for one run:

```bash
raigal scan --include "src/**"
raigal scan --exclude "dist,generated"
```

## Examples

```bash
# Scan
raigal scan
raigal scan ./src
raigal scan --changes
raigal scan --staged
raigal scan --json
raigal scan --sarif

# Fix
raigal fix
raigal fix --dry-run
raigal fix --safe
raigal fix -f
raigal fix --claude
raigal fix -p

# Local agent repair
raigal agent
raigal agent providers
raigal agent connect codex
raigal agent use codex
raigal agent plan
raigal agent monitor --once
raigal agent monitor --background
raigal agent monitor list
raigal agent --provider codex
raigal agent --background
raigal agent --provider claude --apply
raigal agent --provider codex --pr
raigal agent sessions
raigal agent show
raigal agent apply
raigal agent watch
raigal agent stop

# Hooks
raigal hook install --claude
raigal hook install --agent claude,cursor
raigal hook install --claude --quality-gate
raigal hook baseline
raigal hook status
raigal hook uninstall --claude
raigal install claude cursor
raigal uninstall hooks --claude

# CI and reference
raigal ci
raigal ci --sarif
raigal rules --search
raigal badge --owner raigal --repo raigal
raigal trend --limit 20
raigal trends --limit 10
raigal update
raigal version
raigal commands
```

## Fix Workflow

The recommended workflow for getting a project to 100/100:

```text
scan          See all issues
  |
fix --safe    Apply only reversible fixes
  |
fix           Auto-fix formatting, lint, imports, comments
  |
fix -f        Aggressive fixes: dependency audit, unused file removal
  |
fix --claude  Hand off remaining issues to a coding agent
  |
scan          Verify everything is resolved
```
