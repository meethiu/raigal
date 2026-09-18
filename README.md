# Raigal

**Catch the slop AI coding agents leave in your code.**

[![npm version](https://img.shields.io/npm/v/raigal.svg)](https://www.npmjs.com/package/raigal) [![npm downloads](https://img.shields.io/npm/dm/raigal.svg)](https://www.npmjs.com/package/raigal) [![CI](https://github.com/meethiu/raigal/actions/workflows/ci.yml/badge.svg)](https://github.com/meethiu/raigal/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org) [![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/Mzz4A6mfj6)

The patterns Claude Code, Cursor, Codex, and OpenCode leave behind: narrative comments above self-explanatory code, swallowed exceptions, hidden fallbacks, `as any` casts, hallucinated imports, duplicated helpers, dead code, todo stubs, oversized functions. Tests pass. Lint passes. The code rots anyway.

Raigal catches them. 50+ rules across 10 language targets (TypeScript, JavaScript, Expo / React Native, Python, Go, Rust, Ruby, PHP, C#, C/C++). Scores every change 0-100. Sub-second. Deterministic: no LLM in the runtime path, same code in, same score out. MIT-licensed, free CLI.

## Quick start

```bash
npx raigal@latest scan
```

No install needed. Works on any project. Get your score in seconds.

Also available on npm, Yarn, Bun, and Homebrew:

```bash
npm install -g raigal                # npm
yarn dlx raigal scan                 # Yarn (no install)
bun add -g raigal                    # Bun
brew install scanaislop/tap/raigal   # Homebrew
```

See [Installation](#installation) for every option.

## Language support

Raigal supports TypeScript, JavaScript, Expo / React Native, Python, Go, Rust, Ruby, PHP, C#, and C/C++.

Coverage includes formatting, linting, complexity, AI-slop detection, and security checks. Some checks use optional system tools; see [Installation](docs/installation.md) and the [rules reference](docs/rules.md) for details.

```bash
raigal agent                 # repair with your coding agent (Codex/Claude/OpenCode)
raigal fix                   # auto-fix the mechanical issues
raigal fix -f                # aggressive fixes (deps, unused files)
raigal ci                    # CI mode (JSON + gate)
raigal hook install --claude # per-edit hook
```

**Public badge**: Show your score on your README

```markdown
[![raigal](https://badges.raigal.dev/score/<owner>/<repo>.svg)](https://raigal.dev)
```

Run `npx raigal@latest badge` to auto-generate. Free at [raigal.dev](https://raigal.dev).

## See it in action

### Scan

![raigal scan demo](assets/scan.gif)

---

## Installation

The same CLI is published to npm and Homebrew. Pick whichever fits your stack.

**Node / npm**

```bash
# Run without installing
npx raigal@latest scan

# npm
npm install --save-dev raigal

# yarn
yarn add --dev raigal

# pnpm
pnpm add -D raigal

# bun
bun add -d raigal

# Global
npm install -g raigal
```

Package installation does not run dependency lifecycle scripts. After installing, run `raigal-tools` once if you want bundled Ruff and golangci-lint coverage; the core scanner works without it.

**Homebrew** (macOS / Linux)

```bash
brew install scanaislop/tap/raigal
```

Homebrew installs Node.js as a dependency if it isn't already present. Details: [homebrew-tap](https://github.com/scanaislop/homebrew-tap).

**Python / pipx**

```bash
pipx install raigal
```

`pipx` keeps `raigal` in its own isolated environment. Needs Node.js on `PATH`.

Full reference for every channel, optional bundled tooling, and external tools: [docs/installation.md](docs/installation.md).

---

## Usage

Examples below use the installed `raigal` binary. For a one-off latest run, prefix the command with `npx raigal@latest`, for example `npx raigal@latest scan`.

### Command reference

```bash
raigal --help              # clean overview
raigal commands            # every public command and major flag
raigal <command> --help    # detailed help for one command
raigal version             # installed version
raigal -V                  # installed version
raigal update              # current and latest npm versions
```

### Scan

```bash
raigal scan                       # current directory
raigal scan ./src                 # specific directory
raigal scan --changes             # changed files from HEAD
raigal scan --changes --base origin/main  # changed vs a base branch (PRs)
raigal scan --staged              # staged files only
raigal scan -d                    # verbose file/rule detail
raigal scan --json                # JSON output
raigal scan --sarif               # SARIF 2.1.0 output (GitHub code scanning)
raigal scan --format json         # alternate JSON form
raigal scan --include "src/**"    # only matching paths
raigal scan --exclude "dist,gen"  # skip extra paths
```

**Exclude files**: `node_modules`, `.git`, `dist`, `build`, `coverage` excluded by default. Add more in `.raigal/config.yml` (or `.aislop/config.yml`):

```yaml
exclude:
  - "**/*.test.ts"
  - src/generated
```

Or via CLI: `raigal scan --exclude "**/*.test.ts,dist"`

**Unsupported languages**: Raigal only analyses the 10 language targets above. If a repo is mostly something else (Swift, Kotlin, Java, ...), scoring a handful of incidental files would misrepresent it, so Raigal **withholds the score** and says so rather than printing a number off code it never read. `--json` returns `score: null`, `scoreable: false`, and a `coverage` breakdown.

**Per-rule severity**: Override the severity of any rule by id, or turn it off:

```yaml
# .raigal/config.yml
rules:
  ai-slop/narrative-comment: warning   # error | warning | off
  ai-slop/trivial-comment: "off"       # drop this rule entirely
  security/hardcoded-secret: error
```

`off` drops matching diagnostics; `error`/`warning` rewrites severity before scoring and reporting. Absent map keeps default behavior.

**Suppress findings inline**: Silence a specific line when you know better, with an optional reason after `--`:

```ts
// raigal-ignore-next-line ai-slop/hidden-fallback -- options is validated upstream
const opts = { ...defaults, ...(input || {}) };

const legacy = doThing(); // raigal-ignore-line
```

`raigal-ignore-next-line` covers the line below, `raigal-ignore-line` the line it sits on, and `raigal-ignore-file` (place anywhere in the file) the whole file (legacy `aislop-ignore-*` directives remain supported). Name one or more rules to scope the suppression, or omit them to silence every rule on that line. The directive works in any comment syntax (`//`, `#`, `<!-- -->`). Suppressed findings are removed before scoring, and the run reports how many were silenced.

**Ignore whole paths**: Add an `.raigalignore` at the project root (same glob semantics as `exclude`, `#` comments allowed; `.aislopignore` is also supported):

```
src/generated
**/*.snap
legacy
```

**Extend config**: Project config can extend a parent:

```yaml
# .raigal/config.yml
extends: ../../.raigal/base.yml
ci:
  failBelow: 80             # override specific keys
```

**Editor validation**: Point your editor at the JSON Schema in [`schema/aislop.config.schema.json`](schema/aislop.config.schema.json) for autocomplete and validation of `.raigal/config.yml`. Regenerate it from the source config schema with `pnpm gen:schema`.

### Fix

The deterministic layer beneath [`raigal agent`](#run-a-local-repair-agent): auto-fix what's purely mechanical (formatters, unused imports, dead code). For anything that needs judgement, reach for `raigal agent` or hand off to your coding agent with full diagnostic info.

```bash
raigal fix                 # auto-fixes
raigal fix --dry-run       # preview planned steps without writing files
raigal fix --changes       # only rewrite files changed vs HEAD
raigal fix --staged        # only rewrite staged files
raigal fix -d              # detailed fix progress
raigal fix --safe          # only reversible fixes (imports, comment removal, safe formatters)
raigal fix -f              # aggressive: deps, unused files
raigal fix -p              # print an agent handoff prompt
```

`--safe` restricts the run to fixes that cannot change behaviour - unused-import removal, import merging, narrative-comment removal, and formatter runs that do not execute project-controlled configuration. Anything that deletes code, rewrites behaviour/attributes, or can load executable formatter configuration (console/dead-code removal, lint autofixes, Ruby/PHP formatter config, unused-declaration and dependency pruning) is skipped, so a `--safe` run is genuinely "apply and commit".

### Run a local repair agent

`raigal agent` keeps the deterministic scanner in charge while using the coding agent you already have installed. It creates a local git worktree, runs safe fixes, streams a headless Codex / Claude Code / OpenCode repair session, verifies the result with `raigal scan --json`, writes a local session transcript, and leaves the diff for review.

```bash
raigal agent providers        # see installed providers and setup hints
raigal agent connect codex    # run the provider's own local login flow
raigal agent use codex        # save a repo-local default provider
raigal agent use auto         # clear the default and auto-detect
raigal agent plan             # preview provider, worktree, findings, PR/apply behavior
raigal agent monitor          # stream scans when local git changes settle
raigal agent monitor --background
raigal agent monitor list     # list background monitors
raigal agent monitor stop     # stop the latest background monitor
raigal agent monitor --repair --in-place
raigal agent                  # auto-pick an installed provider
raigal agent --provider codex # switch provider
raigal agent --background     # run locally in the background
raigal agent --apply          # apply verified diff back to this repo
raigal agent --pr             # commit, push, and open a draft PR
raigal agent sessions         # list recent local repair sessions
raigal agent show             # show the latest session timeline and summary
raigal agent apply            # apply a reviewed worktree session later
raigal agent watch            # stream the latest session transcript
raigal agent stop             # stop the latest running background session
```

No OpenAI or Anthropic API key is requested by `raigal`; provider CLIs use their own existing local auth. A saved provider default lives in `.raigal/agent/provider.json` and is kept out of commits through the repo's local Git exclude. Session transcripts live under `.raigal/agent/sessions/`, and agent sessions/worktrees are also excluded locally. Provider JSONL is normalized in the terminal stream while raw lines stay in the transcript.

### Hand off to agent

When auto-fix can't solve it, pass the remaining issues to your coding agent with full context:

```bash
raigal fix --claude        # Claude Code
raigal fix --codex         # Codex CLI
raigal fix --cursor        # Cursor (copies to clipboard)
raigal fix --gemini        # Gemini CLI
raigal fix --prompt        # print prompt (agent-agnostic)
```

Other fix handoff flags: `--windsurf`, `--vscode`, `--amp`, `--antigravity`, `--deep-agents`, `--kimi`, `--opencode`, `--warp`, `--aider`, `--goose`, `--pi`, `--crush`.

### Install hook

Runs after every agent edit. Feedback flows back immediately.

```bash
raigal hook install --claude           # Claude Code
raigal hook install --cursor           # Cursor
raigal hook install --gemini           # Gemini CLI
raigal hook install --pi               # pi
raigal hook install                    # pick agents interactively
raigal hook install claude cursor      # specific agents
raigal hook install --agent claude,pi  # comma-separated agents
raigal install claude cursor           # alias for hook install
raigal install hooks --claude          # natural alias for hook install
```

**Runtime adapters** (scan + feedback): `claude`, `cursor`, `gemini`, `pi`.  
**Rules-only** (agent reads rules): `codex`, `windsurf`, `cline`, `kilocode`, `antigravity`, `copilot`.

Hook install flags: `--agent <names>`, `-g, --global`, `--project`, `--dry-run`, `--yes`, `--quality-gate`, plus per-agent shortcuts `--claude`, `--cursor`, `--gemini`, `--pi`, `--codex`, `--windsurf`, `--cline`, `--kilocode`, `--antigravity`, `--copilot`.

**Quality-gate mode**: Blocks if score regresses below baseline.

```bash
raigal hook install --claude --quality-gate
raigal hook baseline                    # re-capture baseline
raigal hook status                      # list installed
raigal hook uninstall --claude          # remove
raigal uninstall claude                  # alias for hook uninstall
raigal uninstall hooks --claude          # natural alias for hook uninstall
```

### MCP server

Expose Raigal as MCP tools for Claude Desktop, Cursor, Codex:

```jsonc
// ~/.cursor/mcp.json or Claude Desktop config
{
  "mcpServers": {
    "raigal": {
      "command": "npx",
      "args": ["-y", "raigal-mcp"]
    }
  }
}
```

**Tools**: `raigal_scan`, `raigal_fix`, `raigal_why`, `raigal_baseline` (legacy `aislop_*` aliases are also registered).

### CI

```bash
raigal ci                  # JSON output, exits 1 if score < threshold
raigal ci --changes --base origin/main  # gate only the files a PR changes
raigal ci --human          # human-friendly CI output
raigal ci --sarif          # SARIF output for code scanning
```

`ci` accepts the same `--changes` / `--staged` / `--base <ref>` scoping as `scan`. Use `--changes --base origin/<target>` to gate a pull request on only the files it touches; the score gate and exit code still apply.

### Other commands

```bash
raigal                         # interactive menu
raigal init                    # create .raigal/config.yml
raigal init --strict           # enterprise-grade gate: all engines, typecheck, failBelow 85
raigal doctor                  # check which engines can run here
raigal rules                   # list rules with severity, fixability, and score impact
raigal rules --search          # searchable rule explorer
raigal badge                   # print badge URL
raigal badge --owner o --repo r --json
raigal trend                   # show score history over time
raigal trends                  # alias for trend
raigal trend --limit 20
raigal update                  # show current and latest npm versions
raigal upgrade                 # alias for update
raigal commands                # full command list
```

**Score history**: a normal (full-project, interactive) `scan` appends a compact record to `.raigal/history.jsonl` (timestamp, score, error/warning counts, file count, CLI version). `raigal trend` and `raigal trends` read it and print a relative-time table plus an ASCII sparkline of recent scores. History is a local side effect only: it is never written for `--json`/`--sarif` output, in CI, or when `RAIGAL_NO_HISTORY=1` is set, so machine output stays clean.

Docs: [commands](docs/commands.md)

---

## CI integration

### Pre-commit

Run directly on staged files:

```bash
raigal scan --staged
```

Or wire it into the [pre-commit](https://pre-commit.com) framework via the bundled hook:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/meethiu/raigal
    rev: v1
    hooks:
      - id: raigal
```

### GitHub Actions

Run `raigal init` and accept the workflow prompt, or add manually. The self-contained form always runs the latest CLI, so there's nothing to bump:

```yaml
name: raigal

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
        run: npx --yes raigal@latest ci
```

Prefer the Marketplace Action? `@v1` tracks the latest release and `version: latest` keeps the CLI current.

```yaml
- uses: actions/checkout@v4
- uses: meethiu/raigal@v1
  with:
    version: latest
```

**GitHub code scanning (SARIF)**: emit a SARIF 2.1.0 report and upload it so findings appear in the Security tab:

```yaml
- run: npx raigal@latest scan . --sarif > raigal.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: raigal.sarif
```

### Bitbucket Pipelines

Bitbucket clones shallow by default, so fetch the PR target branch and gate on only the changed files with `ci --changes --base`:

```yaml
# bitbucket-pipelines.yml
pipelines:
  pull-requests:
    "**":
      - step:
          name: raigal gate
          image: node:24
          clone:
            depth: full   # branch diffs need history
          script:
            - git fetch origin "$BITBUCKET_PR_DESTINATION_BRANCH"
            - npx --yes raigal@latest ci --changes --base FETCH_HEAD
```

`ci` applies the score gate and exit code, so no JSON parsing or hand-rolled threshold is needed. More providers: [CI/CD](docs/ci.md).

### Quality gate

Set minimum score in `.raigal/config.yml` (or `.aislop/config.yml`):

```yaml
ci:
  failBelow: 70
```

`raigal ci` exits 1 when score < threshold. Docs: [CI/CD](docs/ci.md)

---

## For teams

[Raigal](https://raigal.dev) is the hosted platform for teams:

- PR gates with score thresholds
- Standards hierarchy (org -> team -> project)
- Dashboards and agent attribution
- Visual rules manager

Same engines, same scores. CLI is MIT-licensed. [Learn more](https://raigal.dev)

---

## Why Raigal

AI coding tools generate code that compiles and passes tests but ships with patterns no engineer would write. `raigal` gives you one score, one gate, and auto-fixes what it can.

- **One score**: 0-100, enforced in CI. Weighted so sloppy patterns hit harder than style noise.
- **Auto-fix first**: Clears formatters, unused imports, dead code mechanically. Hands off the rest to your agent with full context.
- **Deterministic**: Regex + AST + standard tooling. No LLMs, no API calls. Same code in, same score out.
- **Zero-config start**: `npx raigal@latest scan` works on any repo. Add `.raigal/config.yml` to tune.

## What it catches

Six deterministic engines run in parallel:

| Engine | What it checks | How |
|---|---|---|
| **Formatting** | Code style consistency | Biome, ruff, gofmt, cargo fmt, rubocop, php-cs-fixer, dotnet format, clang-format |
| **Linting** | Language-specific issues | oxlint, ruff, golangci-lint, clippy, expo-doctor, Roslynator, JetBrains InspectCode, cppcheck, clang-tidy |
| **Code Quality** | Complexity and dead code | Function/file size limits, deep nesting, unused files/deps (knip), AST-based unused-declaration removal |
| **AI Slop** | AI-authored code patterns | Narrative comments, trivial comments, dead patterns, unused imports, `as any`, `console.log` leftovers, TODO stubs, generic names |
| **Security** | Vulnerabilities and risky code | eval, innerHTML, SQL/shell injection, dependency audits for JavaScript, Python, Rust, Go, and .NET |
| **Architecture** | Structural rules (opt-in) | Custom import bans, layering rules, required patterns |

See the full [rules reference](docs/rules.md).

---

## Research

Raigal rules are shaped by public scans and benchmark-derived failure modes, not only local fixtures. The [research program](docs/research-program.md) defines how to run repeatable open-source scans: pin the cohort, store raw JSON, classify findings, fix noisy rules with regression tests, and publish the limits.

---

## Docs

[Installation](docs/installation.md) · [Commands](docs/commands.md) · [Rules](docs/rules.md) · [Config](docs/configuration.md) · [Scoring](docs/scoring.md) · [CI/CD](docs/ci.md) · [Telemetry](docs/telemetry.md) · [Research program](docs/research-program.md)

## Community

[Discord](https://discord.gg/Mzz4A6mfj6) for community chat and support · [Discussions](https://github.com/meethiu/raigal/discussions) for questions, rule requests, and false-positive triage · [Issues](https://github.com/meethiu/raigal/issues) for bugs

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). AI assistants: [AGENTS.md](AGENTS.md).

## Acknowledgments

Built on: [Biome](https://biomejs.dev/), [oxlint](https://oxc.rs/), [knip](https://knip.dev/), [ruff](https://docs.astral.sh/ruff/), [golangci-lint](https://golangci-lint.run/), [expo-doctor](https://docs.expo.dev/)

## Contributors

<!-- CONTRIBUTORS-START -->
- [@daveslutzkin](https://github.com/daveslutzkin)
- [@gtheys](https://github.com/gtheys)
- [@heavykenny](https://github.com/heavykenny)
- [@mtschoen](https://github.com/mtschoen)
- [@myke-awoniran](https://github.com/myke-awoniran)
- [@swjturay](https://github.com/swjturay)
- [@yashrajoria](https://github.com/yashrajoria)
<!-- CONTRIBUTORS-END -->

Auto-updated by `.github/workflows/contributors.yml`. [Link commit email](https://github.com/settings/emails) or add to [`.github/contributors-overrides.json`](.github/contributors-overrides.json).

## License

[MIT](LICENSE)
