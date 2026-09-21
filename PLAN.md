# Raigal CLI ↔ Dashboard Integration (v2) Implementation Plan

## Overview
This document tracks Phase 0 reconnaissance and the implementation plan for integrating the proprietary Raigal CLI with the Raigal Cloud platform (`app.raigal.dev`).

---

## 1. Codebase Inventory & Verification

### 1.1 Entry Points & Commands Analysis

| Entry Point / Command | File Location | Code Analysis / Modification? | Gated Status | Rationale |
|---|---|---|---|---|
| `raigal [directory]` (default / interactive) | `src/cli.ts` | Yes (scans or interactive fix) | **Gated** | Analyzes code; falls through to `runScan`. |
| `raigal scan [directory]` | `src/cli.ts`, `src/cli-scan.ts` | Yes | **Gated** | Core scanning engine runner. |
| `raigal ci [directory]` | `src/cli.ts`, `src/commands/ci.ts` | Yes | **Gated** | CI quality gate; runs analysis and evaluates threshold. |
| `raigal fix [directory]` | `src/cli.ts`, `src/commands/fix.ts` | Yes | **Gated** | Analyzes findings and modifies source code. |
| `raigal agent [directory]` | `src/cli/agent-command.ts`, `src/commands/agent.ts` | Yes | **Gated** | Runs worktree repair agent, scans and applies fixes. |
| `raigal agent plan` | `src/cli/agent-command.ts`, `src/commands/agent-plan.ts` | Yes | **Gated** | Runs scan to preview findings and diff plan. |
| `raigal agent apply` | `src/cli/agent-session-command.ts`, `src/commands/agent-apply.ts` | Yes | **Gated** | Applies worktree code modifications back to repository. |
| `raigal agent monitor` | `src/cli/agent-monitor-command.ts`, `src/commands/agent-monitor.ts` | Yes | **Gated** | Continuous background scanning/repair loop. |
| `raigal init [directory]` | `src/cli.ts`, `src/commands/init.ts` | Yes | **Gated** | Initializes `.raigal/config.yml` and workflow. (Per spec Section 1). |
| `raigal badge [directory]` | `src/cli-extra-commands.ts`, `src/commands/badge.ts` | Minimal (git remote check) | **Gated** | Per spec Section 1. |
| `raigal trend [directory]` | `src/cli-extra-commands.ts`, `src/commands/trend.ts` | Local history display | **Gated** | Per spec Section 1. |
| `raigal hook run` | `src/cli/hook-command.ts`, `src/commands/hook.ts` | Yes | **Gated (Non-breaking)** | Runs analysis during commit/tool hooks. Must exit 0 / no-op if unlicensed. |
| `raigal hook baseline` | `src/cli/hook-command.ts`, `src/commands/hook.ts` | Yes | **Gated** | Runs scan to generate baseline findings file. |
| `raigal-mcp` binary | `src/mcp.ts` | Yes | **Gated (Non-breaking)** | MCP server with scan/fix/baseline tools. Returns error message in content, no process crash. |
| Library exports | `src/index.ts` (`dist/index.js`) | Yes | **Gated** | Direct API usage of `scanCommand`, `fixCommand`, etc. |
| Framework Adapters | `src/framework-adapters/*` (Vite, Astro, Nuxt, SvelteKit, Expo) | Yes | **Gated (Non-breaking)** | Spawns `raigal ci` or `scan`. If unlicensed, prints notice, produces no diagnostics, exits 0. |
| VS Code Extension | `editors/vscode/src/extension.ts` | Yes | **Gated (Non-breaking)** | Spawns `raigal scan --json`. If unlicensed (exit 30/31), produces no diagnostics, no crash. |
| GitHub Action | `action.yml` | Yes | **Gated** | Executes `raigal ci` with `RAIGAL_TOKEN` and OIDC. Fails if unlicensed (exit 30). |
| Pre-commit Hook | `.pre-commit-hooks.yaml` | Yes | **Gated (Non-breaking)** | Runs `raigal scan --staged`. Must exit 0 on licence failure. |
| `raigal login` | `src/commands/login.ts` (new) | No | **Ungated** | Device flow & token login. |
| `raigal logout` | `src/commands/logout.ts` (new) | No | **Ungated** | Revokes session & clears cache. |
| `raigal whoami` | `src/commands/whoami.ts` (new) | No | **Ungated** | Displays current org, user, trial, and allowed owners. |
| `raigal telemetry --show` | `src/commands/telemetry-show.ts` (new) | No | **Ungated** | Prints JSON that would be sent for last run. |
| `--help`, `-h`, `help` | `src/cli.ts` | No | **Ungated** | Top-level and subcommand help. |
| `version`, `-V`, `-v`, `--version` | `src/cli.ts` | No | **Ungated** | Prints CLI version. |
| `commands` | `src/cli-extra-commands.ts` | No | **Ungated** | Prints command reference. |
| `update`, `upgrade` | `src/cli-extra-commands.ts` | No | **Ungated** | Checks latest version on npm. |
| `doctor [directory]` | `src/cli.ts`, `src/commands/doctor.ts` | No (checks installed toolchains) | **Proposed: Ungated** | Diagnostics on system tooling; does not analyze project source code. |
| `rules [directory]` | `src/cli-extra-commands.ts`, `src/commands/rules.ts` | No (explains rule catalog) | **Proposed: Ungated** | Documentation/reference of rules; no source code analysis. |
| `hook install/uninstall/status` | `src/cli/hook-command.ts`, `src/commands/hook.ts` | No (edits hook config) | **Proposed: Ungated** | Hook lifecycle setup. |
| `agent connect/providers/use` | `src/cli/agent-command.ts` | No (local setup hints) | **Proposed: Ungated** | Provider selection and auth setup. |
| `agent sessions/show/stop/watch` | `src/cli/agent-session-command.ts` | No (session metadata) | **Proposed: Ungated** | Inspecting local session logs. |
| `agent monitor list/show/stop` | `src/cli/agent-monitor-command.ts` | No (monitor metadata) | **Proposed: Ungated** | Managing monitor processes. |

---

## 2. Telemetry Audit

- **Mechanism:** Anonymous PostHog telemetry via `src/telemetry/client.ts`.
- **Host:** Default `https://eu.i.posthog.com` (`RAIGAL_POSTHOG_HOST`).
- **Key:** Public PostHog project token `RAIGAL_POSTHOG_KEY` (currently defaults to `""`).
- **Identity:** Anonymous UUID install ID stored in `~/.raigal/install_id` (or `XDG_STATE_HOME/raigal/install_id`).
- **Events Tracked:** `cli_installed`, `cli_command_started`, `cli_command_completed`, `mcp_server_started`, `mcp_tool_called`, `hook_scan_completed`.
- **Redaction:** `redaction.ts` ensures only allowlisted metadata is sent. Never contains source code, file contents, secrets, paths, or tokens.
- **Opt-Out:** Disabled if `RAIGAL_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`, `CI=true`, or `telemetry.enabled: false` in config.
- **Separation:** As mandated by Section 1, PostHog telemetry remains strictly separate from organization activity logging (`POST /v1/runs`).
- **New Feature:** `raigal telemetry --show` will be added to print the exact redacted JSON event payload.

---

## 3. Dependency Licence Audit

Direct dependencies verified against permissive standards:
- All 19 npm dependencies are MIT, Apache-2.0, ISC, BSD-3-Clause, or BlueOak-1.0.0.
- No GPL or AGPL dependencies are bundled into the JavaScript output.
- Bundled external binaries fetched by `scripts/install-tools.mjs`:
  - `ruff`: MIT / Apache-2.0.
  - `golangci-lint`: GPL-3.0. Downloaded as a standalone binary into `tools/bin/golangci-lint` and invoked as a separate subprocess via `node:child_process`. It is not bundled or linked into the JavaScript distribution.
  - Roslyn Analyzers: Apache-2.0 / MIT.
- Release guard: A new CI check `scripts/check-licenses.mjs` will be added to automatically fail the build if any GPL/AGPL dependencies are added to `dependencies`.

---

## 4. Exit Codes Verification

Existing exit codes in codebase:
- `0`: Success / clean scan / passing quality gate.
- `1`: Quality gate failure / scan threshold breach / general CLI error.
- Verified: Exit codes `30` and `31` are completely unused across the entire repository.
- Conformance:
  - `30`: Licence denied, expired trial, non-allowlisted owner, or missing credential.
  - `31`: Licence unverifiable (network outage / server error with no valid offline lease).

---

## 5. Architectural Design & Implementation Plan

### 5.1 Directory & Module Layout
New code will be organized cleanly under `src/cloud/`:
```
src/cloud/
  contract.ts             # Exact copy of Section 2 Zod schemas
  contract.sha256         # SHA-256 checksum of contract.ts
  types.ts                # Derived TypeScript types
  jwt.ts                  # Offline Ed25519 verification using node:crypto (no extra dependencies)
  keys.ts                 # Embedded public keys (current & next, keyed by kid)
  paths.ts                # Cross-platform config/state paths (XDG, Windows AppData)
  credentials.ts          # Read/write/delete credentials (0o600 permissions)
  entitlement.ts          # Cached lease, refresh logic, 72h grace, GitHub OIDC
  owner.ts                # Local repo owner detection & allowlist matching
  gate.ts                 # Central requireEntitlement() gate function
  policy.ts               # Policy client, caching, and merge engine (org -> team -> repo -> local)
  fingerprint.ts          # SHA-256 fingerprinting & secret message scrubbing
  context.ts              # Git & CI context discovery (commit, branch, PR, OIDC)
  recorder.ts             # Commander lifecycle hook recorder (run steps, timing, flags)
  outbox.ts               # Outbox buffer (5MB cap, FIFO) for offline run uploads
  client.ts               # HTTP client for Raigal Cloud API (timeout, retries, auth headers)
```

### 5.2 Offline Ed25519 Verification Strategy
Instead of adding `jose` as a runtime dependency, Node's built-in `node:crypto` will be used:
1. Parse JWT header: verify `alg === "EdDSA"`, check `kid` against embedded keys.
2. Parse JWT payload: validate against `EntitlementClaims` schema in `contract.ts`.
3. Verify signature: `crypto.verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(sig, "base64url"))`.
4. Validate `iss === "https://app.raigal.dev"`, check `exp` against current timestamp (allowing grace on outage), and check `min_cli_version <= APP_VERSION`.
This keeps dependencies minimal, fast, and secure.

### 5.3 Gate Integration Point
A single function `requireEntitlement({ directory, mode })` will be placed in `src/cloud/gate.ts` and called:
1. In `src/commands/scan.ts` (protects `scan` and `ci`).
2. In `src/commands/fix.ts` (protects `fix`).
3. In `src/commands/agent.ts` and `src/commands/agent-plan.ts` (protects agent worktree sessions and plans).
4. In `src/commands/agent-monitor.ts` (protects monitor loop).
5. In `src/commands/init.ts` (protects `init`).
6. In `src/commands/badge.ts` (protects `badge`).
7. In `src/commands/trend.ts` (protects `trend`).
8. In `src/mcp.ts` (returns non-breaking error content for MCP tools).
9. In `src/framework-adapters/core.ts` (non-breaking 0 exit).
10. In `src/hooks/io/scoped-scan.ts` and `baseline.ts` (non-breaking 0 exit for git hooks).

### 5.4 Self-Scan Constraints
All new files and functions will adhere strictly to:
- File LOC <= 400
- Function LOC <= 80
- Nesting depth <= 5
- Parameters <= 6

---

## 6. Discrepancies & Resolutions

1. **Branding & Legacy References:**
   - The document mentions `.aislop/` in some places. The repo has recently migrated to `.raigal/` while preserving fallback reads for legacy `.aislop/`.
   - Resolution: Store all cloud credentials, leases, and outbox in `.raigal/` (or platform standard directories), maintaining backwards compatibility.
2. **PostHog Key:**
   - `RAIGAL_POSTHOG_KEY` is currently unset by default.
   - Resolution: Keep PostHog independent. The new `raigal telemetry --show` command will display the pending/last event format regardless of whether the key is set.
3. **`telemetry --show` Command:**
   - Currently not present in the CLI.
   - Resolution: Implement as a subcommand in `src/cli-extra-commands.ts` or `src/commands/telemetry-show.ts`.

---

## 7. Open Questions for Human Approval

1. **Gate classification for auxiliary commands:**
   - Should `raigal doctor` and `raigal rules` be ungated?
   *Recommendation:* Keep them **ungated** so prospective users and engineers can inspect tool prerequisites and rule definitions without needing an active organization licence.
   - Should `raigal agent connect` and `raigal agent providers` be ungated?
   *Recommendation:* Keep them **ungated** so local provider auth can be verified before entering a gated repair session.
2. **Public Key Bootstrap:**
   - What key ID (`kid`) and public key should be embedded as the initial key in the CLI?
   *Recommendation:* We will include a default development/staging Ed25519 public key in `src/cloud/keys.ts` with documentation for injecting production keys via environment variable or release build configuration.
3. **Pre-commit hook behaviour:**
   - Confirm that if a pre-commit hook runs `raigal scan --staged` without an active licence, it should output a one-line stderr message and exit code `0` so developer git commits are not blocked.
   *Recommendation:* Yes, follow Section 1 rule 4 ("never break the host tool: print one line, produce no diagnostics, exit 0").
