# Raigal Security Model

This document outlines the security architecture, threat model, boundaries, and guarantees of the Raigal CLI and its integration surfaces.

## 1. Secret Handling Guarantees

### Principle of Zero Secret Exposure
Secret values, API credentials, private keys, database passwords, and authentication tokens detected in source code must **never leave the machine** and must **never appear in any CLI output surface, transcript, or log**.

When secrets are detected by the security engine (`security/hardcoded-secret`):
1. **Fixed diagnostic message**: The diagnostic message is strictly set to a generic message:
   `"Hardcoded credential. Rotate it and load it from the environment."`
2. **Stripped source context**: Source code lines, snippets, column offsets, and matching values are stripped at the engine boundary (`stripSecretDiagnostics` in the engine orchestrator).
3. **Redaction token mask**: Any output containing potential credential literals across output surfaces is redacted using typed tokens:
   - `[REDACTED:aws]`
   - `[REDACTED:github]`
   - `[REDACTED:slack]`
   - `[REDACTED:database_url]`
   - `[REDACTED:private_key]`
   - `[REDACTED:jwt]`
   - `[REDACTED:password]`
   - `[REDACTED:api_key]`
   - `[REDACTED:token]`

### Protected Surfaces Matrix
All 15 execution and integration surfaces enforce secret redaction:
- `scan` and `scan -d` (standard and verbose terminal renderers)
- `scan --json` (machine-readable JSON outputs)
- `scan --sarif` (SARIF 2.1.0 log outputs)
- `ci` and `ci --human` (CI mode summaries and findings)
- `fix --dry-run` and `fix -d` (auto-fix dry-run previews and verbose logs)
- `fix --prompt` (agent prompt generation)
- `fix --<agent>` handoffs (prompts passed to external agents via CLI or clipboard)
- Per-edit hook envelopes (`aislop.hook.v2` / `raigal.hook.v1`)
- MCP tool call responses (`raigal_scan`, `raigal_fix`, `raigal_why`, `raigal_baseline`)
- Agent repair plans and session transcripts (`.raigal/agent/sessions/*.jsonl`)
- Historical scan logs (`.raigal/history.jsonl`)
- CLI error rendering and `--debug` diagnostic outputs
- Syntax error and unparseable file exception messages

## 2. Agent Handoff Boundaries

When passing diagnostics to coding agents:
- Secret rule diagnostics omit code snippets completely (`snippetFor` and `getCodeSnippet` return `null`).
- The prompt explicitly instructs the agent:
  `"Never print, copy, commit, or echo secret values or credentials. Replace all hardcoded credentials and secrets with environment-variable references (e.g. process.env.KEY)."`
- Prompts are passed through `maskSecrets()` before being copied to the clipboard or passed as CLI arguments.
