---
description: "Comprehensive command-line interface reference and flags for Raigal."
icon: terminal
---

# CLI Commands & Flags

Raigal provides an intuitive CLI surface designed for local developer iteration and automated CI workflows.

## Command Index

| Command | Action |
|---|---|
| `raigal [dir]` | Interactive terminal dashboard or default scan |
| `raigal scan [dir]` | Run full quality scan and output score |
| `raigal fix [dir]` | Apply deterministic autofixes or generate agent prompts |
| `raigal ci [dir]` | Quality gate with threshold exit codes for CI/CD |
| `raigal agent [dir]` | Autonomous repair sessions in isolated worktrees (Claude, Cursor, OpenCode) |
| `raigal hook` | Manage AI coding agent real-time interception hooks |
| `raigal report-pr-closed` | Synchronize PR closed/merged lifecycle with Raigal Cloud |
| `raigal telemetry` | Inspect recorded cloud run payloads and outbox status |
| `raigal login` | Sign in via browser OAuth or API token |
| `raigal logout` | Clear local credentials and cached offline leases |
| `raigal whoami` | Inspect active credentials, user, organization, and allowed GitHub repos |
| `raigal doctor` | Check system binaries, tools, and engine status |
| `raigal rules` | Display rule explanations and impact weights |
| `raigal init` | Create configuration file and optional CI workflow |

## Command Reference

### `raigal scan`

Evaluates the target directory and outputs the score breakdown.

```bash
raigal scan [options] [path]
```

**Options:**
- `--changes`: Only scan files changed relative to git `HEAD`.
- `--staged`: Scan git staged files only (ideal for pre-commit hooks).
- `--base <ref>`: Compare diff against a specific git reference (e.g., `origin/main`).
- `-d, --verbose`: Show file-level details per rule.
- `--json`: Output full raw diagnostic tree as JSON.
- `--sarif`: Output diagnostics in OASIS SARIF 2.1.0 format.
- `--format <format>`: Explicitly set output format (`json` or `sarif`).
- `--fail-on <level>`: Exit with code 1 on findings matching `none`, `error`, or `warning`.

### `raigal ci`

Designed specifically for automated pull request quality gates in CI runners.

```bash
raigal ci [options] [path]
```

- Blocks PRs if the overall score falls below the configured threshold (default: 80).
- Accepts `--human` to output clean colored summaries in CI build logs.
- `--changes`: Only gate files changed vs `--base` (or `HEAD`).
- `--staged`: Only gate staged files.
- `--base <ref>`: Diff base for `--changes` (e.g., `origin/main`).
- `--sarif`: Output SARIF 2.1.0 for GitHub code scanning annotations.

### `raigal fix`

Applies deterministic, reversible fixes without risking logical hallucinations.

```bash
raigal fix [options] [path]
```

- `--safe`: Only applies guaranteed-safe changes (imports, comment removal, safe formatters).
- `-f, --force`: Run aggressive fixes (dependency audits and framework alignments).
- `--dry-run`: Previews proposed fixes without writing to disk.
- `-p, --prompt`: Formats remaining unfixed issues into a targeted prompt for your coding agent.
- `--changes` / `--staged`: Restrict fixes to changed or staged files.
- `--base <ref>`: Diff base for `--changes`.

### `raigal agent`

Runs autonomous repair sessions using local AI coding tools inside an isolated git worktree.

```bash
raigal agent [options] [path]
```

**Key Flags:**
- `--provider <provider>`: Agent provider to invoke (`auto`, `codex`, `claude`, `opencode`).
- `--target-score <n>`: Score threshold to converge toward (default: 90).
- `--max-turns <n>`: Maximum provider turns for one repair attempt (default: 4).
- `--limit <n>`: Maximum number of findings to hand to the provider (default: 8).
- `--in-place`: Edit current worktree instead of creating an isolated git worktree.
- `--apply`: Apply accepted diff back to the original worktree upon completion.
- `-y, --yes`: Skip interactive confirmation prompts for `--apply`.
- `--dry-run`: Print the selected provider and execution plan without running.
- `--background`: Start the agent process in the background and return immediately.
- `--no-fix`: Skip deterministic safe fixes before handing off to the provider.
- `--commit`: Commit the verified diff onto an agent repair branch.
- `--pr`: Push the agent branch and open a GitHub Pull Request automatically.
- `--branch <name>`: Custom branch name for `--commit` or `--pr`.
- `--base <branch>`: Target base branch for `--pr`.
- `--title <title>`: Pull request title for `--pr`.
- `--commit-message <msg>`: Custom commit message.
- `--ready`: Open a ready-for-review PR instead of a draft.
- `--cleanup`: Remove generated worktree even if a diff remains.

**Agent Subcommands:**
- `raigal agent plan [dir]`: Preview provider, worktree, findings, and publish actions without editing.
- `raigal agent connect [provider]`: Authenticate with a local coding-agent provider using its CLI auth.
- `raigal agent providers`: List detected local coding-agent providers and status.
- `raigal agent use [provider]`: Set or display the default agent provider preference for this repo.
- `raigal agent sessions [dir]`: List active and past worktree repair sessions.
- `raigal agent show <session-id>`: Inspect diff and metadata from an agent session.
- `raigal agent apply <session-id>`: Merge changes from a session into your working branch.
- `raigal agent monitor [dir]`: Watch git changes and trigger repairs when scores drop below target.

### `raigal report-pr-closed`

Reports a pull request closed or merged event to Raigal Cloud to synchronize the Remediation Kanban board.

```bash
raigal report-pr-closed --pr <number> [--merged]
```

- `--pr <number>`: Pull request number (automatically read from `GITHUB_EVENT_PATH` in GitHub Actions).
- `--merged`: Flag indicating whether the pull request was merged into the base branch.

### `raigal login` & `raigal logout`

Manage Raigal Cloud credentials and offline lease authentication.

```bash
# Interactive browser OAuth login
raigal login

# Headless login via API token from stdin
echo "rgl_live_..." | raigal login --with-token

# Clear local credentials and offline cache
raigal logout
```

### `raigal whoami`

Displays active user, organization, subscription tier, and authorized GitHub repositories.

```bash
raigal whoami
```

### `raigal telemetry`

Inspects recorded cloud run telemetry payloads and outbox transmission status.

```bash
raigal telemetry --show
raigal telemetry --show --json
```

### `raigal doctor`

Verifies local environment, linters, formatters, and coding-agent binaries.

```bash
raigal doctor
```
