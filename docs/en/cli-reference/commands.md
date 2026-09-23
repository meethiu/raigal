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
| `raigal fix [dir]` | Apply deterministic autofixes |
| `raigal ci [dir]` | Quality gate with threshold exit codes |
| `raigal hook` | Manage AI coding agent interception hooks |
| `raigal agent` | Run worktree repair sessions with Claude/Cursor/OpenCode |
| `raigal whoami` | Inspect active credentials and organization context |
| `raigal login` | Interactive browser login via Clerk OAuth |
| `raigal logout` | Clear local credentials and offline leases |
| `raigal doctor` | Check system binaries, tools, and engine status |
| `raigal rules` | Display rule explanations and impact weights |

## Command Reference

### `raigal scan`

Evaluates the target directory and outputs the score breakdown.

```bash
raigal scan [options] [path]
```

**Options:**
- `--changes`: Only scan files changed relative to git `HEAD`.
- `--base <ref>`: Compare diff against a specific git reference (e.g., `origin/main`).
- `--staged`: Scan git staged files only (ideal for pre-commit hooks).
- `--json`: Output full raw diagnostic tree as JSON.
- `--sarif`: Output diagnostics in OASIS SARIF 2.1.0 format.
- `--fail-on <level>`: Exit with code 1 on findings matching `none`, `error`, or `warning`.

### `raigal ci`

Designed specifically for automated pull request checks.

```bash
raigal ci [options] [path]
```

- Blocks PRs if the overall score falls below the configured threshold (default: 80).
- Accepts `--human` to output clean colored summaries in CI build logs.

### `raigal fix`

Applies deterministic, reversible fixes without risking logical hallucinations.

```bash
raigal fix --safe .
```

- `--safe`: Only applies guaranteed-safe changes (formatting, trivial comment removal).
- `--dry-run`: Previews proposed fixes without writing to disk.
- `-p, --prompt`: Formats remaining unfixed issues into a targeted LLM prompt.
