# Raigal CLI Defects Fix Plan

## Overview
Comprehensive plan for fixing the 11 defects found across P0, P1, P2, and P3 phases in the Raigal CLI codebase. All work adheres to the test-first methodology, self-scanning constraints (files ≤ 400 LOC, functions ≤ 80 LOC, nesting ≤ 5, params ≤ 6), cross-platform compatibility, zero literal secrets in repository/fixtures, and clean conventional commits.

---

## 1. Codebase Verification & Path Discrepancies

Prompt names and paths verified against actual repository code:

| Item in Prompt | Verified Location / Status | Notes |
|---|---|---|
| `security/hardcoded-secret` | `src/engines/security/secrets.ts` | Confirmed rule ID and detection logic |
| `raigal fix --prompt` | `src/commands/fix.ts`, `src/commands/fix-code.ts` | `printPrompt` and `launchAgent` emit prompt |
| `src/agents/prompt.ts` | `src/agents/prompt.ts` | `buildRepairPrompt` and `snippetFor` |
| `.raigal/agent/sessions/` | `src/agents/session.ts`, `session-store.ts` | JSONL transcript persistence |
| `.raigal/history.jsonl` | `src/utils/history.ts` | `appendHistory` appends scan runs |
| SARIF output | `src/output/sarif.ts` | Driver name is currently `"aislop"` |
| `src/utils/limits.ts` | Not yet created | New helper module to create for Task 3 |
| `src/utils/source-masker.ts` | `src/utils/source-masker.ts` | Lexer/masker for JS, C#, Python, etc. |
| `src/engines/ai-slop/comments.ts` | `src/engines/ai-slop/comments.ts` | Trivial comment detector |
| `src/engines/ai-slop/comment-blocks.ts` | `src/engines/ai-slop/comment-blocks.ts` | Comment block collector |
| `src/engines/ai-slop/narrative-comments-fix.ts` | `src/engines/ai-slop/narrative-comments-fix.ts` | Comment fixer |
| `src/config/schema.ts` | `src/config/schema.ts` | Zod schema currently non-strict, catches errors |
| `src/config/index.ts` | `src/config/index.ts` | Catches parse errors and falls back to defaults |
| `src/config/extends.ts` | `src/config/extends.ts` | Extends chain loader |
| `src/commands/scan-exit-code.ts` | `src/commands/scan-exit-code.ts` | Currently evaluates `failBelow` score gate |
| `src/telemetry/client.ts` | `src/telemetry/client.ts` | Sends fetch even when `POSTHOG_KEY` is empty |
| `tools/jb/aislop.DotSettings` | `tools/jb/aislop.DotSettings` | Needs renaming to `raigal.DotSettings` |
| `src/hooks/feedback.ts` | `src/hooks/feedback.ts` | Schema is `"aislop.hook.v2"`, needs `"raigal.hook.v1"` |
| `src/mcp.ts` | `src/mcp.ts` | Registers `aislop_*` and `raigal_*` tools |
| `examples/architecture-rules.yml` | `examples/architecture-rules.yml` | Uses invalid `module:` key; needs `match:`, `forbid:` |
| `tests/helpers/fake-secrets.ts` | Not yet created | Helper with `fakeSecrets()` runtime factory |
| `docs/security-model.md` | Not yet created | New security model documentation |
| `docs/dedupe-audit.md` | Not yet created | Deduplication audit documentation |
| `scripts/check-branding.mjs` | Not yet created | Branding allowlist verification script |

---

## 2. Phase Breakdown & Tasks

### Phase P0: Secret Leakage (Task 1)
- **Goal:** Secret values must never leave the machine.
- **Files to touch:**
  - `tests/helpers/fake-secrets.ts` (new runtime secret generator)
  - `src/utils/mask-secrets.ts` (new boundary redaction helper: `maskSecrets(text)`)
  - `src/engines/types.ts` (rule metadata or diagnostic flag for secret class)
  - `src/engines/orchestrator.ts` (strip source snippets/previews from secret-class diagnostics at engine boundary)
  - `src/commands/fix-code.ts` (`getCodeSnippet` returns `null` for secret rules; prompt instructed not to commit secrets)
  - `src/agents/prompt.ts` (`snippetFor` returns `null` for secret rules; repair prompt instruction added)
  - `src/agents/session.ts` (scrub session events with `maskSecrets` before appending to transcript)
  - `src/utils/history.ts` (mask before appending)
  - `src/hooks/feedback.ts` (mask findings and messages in hook envelope)
  - `src/mcp.ts` (mask content before returning ok/err responses)
  - `src/output/sarif.ts` (ensure no snippet text for secret rules or any rules)
  - `src/ui/logger.ts`, `src/ui/error.ts` (scrub debug output and error messages)
  - `docs/security-model.md` (document security boundary guarantees)
  - `tests/leak-matrix.test.ts` (comprehensive leak matrix across all 15+ surfaces)
- **Risks & Mitigations:**
  - Redaction regexes could impact performance: compile regexes once.
  - Unparseable file error path could leak source line: wrap parser try/catches to scrub error messages.

### Phase P1: Correctness (Tasks 2 to 6)

#### Task 2: Duplicate findings inflate scores
- **Goal:** Deduplicate findings representing the same underlying issue on the same file/line.
- **Files to touch:**
  - `src/engines/lint/oxlint-config.ts` (turn off `no-eval` when security engine is enabled)
  - `src/engines/equivalence-dedupe.ts` (new data-driven equivalence table and deduplication pass)
  - `src/engines/orchestrator.ts` (integrate equivalence deduplication before scoring)
  - `docs/dedupe-audit.md` (audit report grouping diagnostics by file/line across fixture and repo)
  - `tests/dedupe-equivalence.test.ts` (tests for eval, unused-import, tie-breaking, score stability)
- **Equivalence Rules:**
  - `security/eval` vs `eslint/no-eval`: keep `security/eval` (severity error vs warning).
  - `ai-slop/unused-import` vs `eslint/no-unused-vars`: keep `ai-slop/unused-import` on same line only if import.
  - Severity tie: keep native Raigal rule.

#### Task 3: One boundary rule for all complexity limits
- **Goal:** Consistent integer formula `Math.floor(max * multiplier * 110 / 100)` and `value > limit`.
- **Files to touch:**
  - `src/utils/limits.ts` (new helper: `exceedsLimit(value, max, multiplier = 1)`)
  - `src/engines/code-quality/complexity.ts` (use `exceedsLimit` for file LOC and function LOC)
  - `src/engines/code-quality/complexity-functions.ts` (use `exceedsLimit` for nesting and params)
  - `tests/limits-boundary.test.ts` (exact boundary tests: 88/89 fn, 440/441 file, 5/6 nesting, 6/7 params, 880/881 tsx, 55/56 with max 50, 11/12 with max 10)
- **Formula Verification:**
  - Function max 80: `Math.floor(80 * 1 * 1.1) = 88`. 88 passes, 89 flags.
  - File max 400: `Math.floor(400 * 1 * 1.1) = 440`. 440 passes, 441 flags.
  - TSX file max 400: multiplier 2 applied to max before tolerance -> max 800. `Math.floor(800 * 1.1) = 880`. 880 passes, 881 flags.
  - Nesting max 5: `Math.floor(5 * 1.1) = 5`. 5 passes, 6 flags.
  - Params max 6: `Math.floor(6 * 1.1) = 6`. 6 passes, 7 flags.

#### Task 4: Fixer corrupts template-literal contents
- **Goal:** Prevent template-literal and JSX string contents from being classified as comments or modified by fixers.
- **Files to touch:**
  - `src/utils/source-masker.ts` (robust lexer classifying code, string, template quasi, template expression `${...}`, comment, regex, JSX text)
  - `src/engines/ai-slop/comments.ts` (only match comments, never template or string text)
  - `src/engines/ai-slop/comment-blocks.ts` (only collect genuine comment blocks)
  - `src/engines/ai-slop/narrative-comments-fix.ts` (check range start token is a comment before deleting)
  - `src/commands/fix-steps.ts` or post-fix validation (invariant check: multiset of string and template literals before and after fix must match exactly; revert if mismatch)
  - `tests/template-literal-safety.test.ts` (table-driven tests for scan and fix)

#### Task 5: Invalid config must fail closed
- **Goal:** Strict config validation; exit code 2 on config error; host tools exit 0 with 1 line.
- **Files to touch:**
  - `src/config/schema.ts` (use `.strict()` on objects; formatting function to format Zod errors with file path, key path, closest known key suggestion)
  - `src/config/index.ts` (raise config error rather than swallowing with exit 0)
  - `src/config/extends.ts` (validate each file in extends chain individually)
  - `src/commands/scan.ts`, `src/commands/ci.ts`, `src/commands/fix.ts`, `src/cli.ts` (handle config error with exit code 2)
  - Hook commands / host adapters (handle config error by printing one line and exiting 0)
  - `src/commands/init.ts` (ensure init output adheres to strict schema)
  - `tests/config-fail-closed.test.ts`

#### Task 6: Predictable exit codes for scan
- **Goal:** `raigal scan` exits 1 only on error-severity diagnostics; score gate stays in `ci`.
- **Files to touch:**
  - `src/commands/scan-exit-code.ts` (separate scan exit code logic from ci exit code logic)
  - `src/commands/scan.ts` (add `--fail-on <none|error|warning>` option, default `error`)
  - `src/cli.ts`, `src/cli-scan.ts` (wire up `--fail-on` flag)
  - `docs/commands.md` and pre-commit documentation
  - `tests/scan-exit-code.test.ts`

---

### Phase P2: Hygiene (Tasks 7 to 10)

#### Task 7: Telemetry
- **Goal:** Zero network requests when `POSTHOG_KEY` is empty; rename `aislop_version` to `cli_version`; opt-out variables; `telemetry --show`.
- **Files to touch:**
  - `src/telemetry/client.ts` (disable network when key is empty, rename property to `cli_version`)
  - `src/commands/telemetry-show.ts` (print exact pending event and enabled status)
  - `scripts/check-tarball-keys.mjs` (new CI guard against unapproved PostHog keys in package tarball)
  - `package.json` (wire guard script)
  - `tests/telemetry-network.test.ts`

#### Task 8: Remove branding leftovers
- **Goal:** Rename remaining `aislop` references to `raigal`, except deliberate legacy reads.
- **Files to touch:**
  - `src/output/sarif.ts` (`tool.driver.name` -> `raigal`, help URLs)
  - `tools/jb/aislop.DotSettings` -> `tools/jb/raigal.DotSettings`, update `package.json` and `src/utils/tooling.ts`
  - `src/hooks/feedback.ts` (schema `raigal.hook.v1`)
  - `src/hooks/install/*`, `src/hooks/adapters/*` (markers `raigal.mdc`, `RAIGAL.md`, `<!-- raigal:begin v1 -->`, `__raigal.hash`)
  - Hook migration logic (detect and clean/upgrade old `aislop` installs)
  - Temp paths: replace predictable temp names with `fs.mkdtemp(path.join(os.tmpdir(), "raigal-"))`
  - `scripts/check-branding.mjs` (branding allowlist guard)
  - Keep deliberate legacy reads: `.aislop/`, `.aislopignore`, `aislop-ignore-*`, `AISLOP_NO_TELEMETRY`
  - Preserve LICENSE, THIRD_PARTY_NOTICES.md, and upstream copyright headers unchanged
  - `tests/branding.test.ts`

#### Task 9: MCP tool names and architecture examples
- **Goal:** Exactly 4 MCP tools; verified `raigal_why` doc links; correct architecture rule keys.
- **Files to touch:**
  - `src/mcp.ts` (register only `raigal_scan`, `raigal_fix`, `raigal_why`, `raigal_baseline`)
  - `src/mcp/tools.ts` (remove `aislop_*` aliases; verify doc link builder with configurable base URL)
  - `examples/architecture-rules.yml` (replace `module:` with `match:` and `forbid:`)
  - `tests/mcp-tools.test.ts`, `tests/architecture-examples.test.ts`

#### Task 10: Make the report honest
- **Goal:** Complete `docs/security-model.md` and align docs/README.
- **Files to touch:**
  - `docs/security-model.md` (sections: secret handling, telemetry, temp files, repository code execution table)
  - `README.md`, `docs/commands.md` (update scan exit codes, config errors, rule IDs)

---

### Phase P3: Untrusted Mode (Task 11)
- **Goal:** Audit code execution via `RAIGAL_EXEC_MARKER`, add `--untrusted` flag and `RAIGAL_UNTRUSTED=1`.
- **Files to touch:**
  - Audit fixtures in `tests/fixtures/exec-audit/` (Knip JS/TS, RuboCop require, .php-cs-fixer.php, Cargo build.rs, Expo app.config.js, C# project evaluation)
  - `src/engines/orchestrator.ts`, `src/cli-scan.ts`, `src/commands/scan.ts`, `src/commands/fix.ts`
  - Skip unsafe engines in untrusted mode and output notice of skipped tools
  - Document results in `docs/security-model.md`
  - `tests/untrusted-mode.test.ts`

---

## 3. Decisions & Open Questions

- **Exit code 2:** Verified that exit code 2 is completely unused across the codebase. Approved for config errors in scan, ci, fix, and hook runtime.
- **Hook runtime config error:** Host tools exit 0 with a one-line warning so host IDEs/git commits are never broken by typos.
- **Hook schema version:** `raigal.hook.v1` adopted as decided.
- **MCP server tools:** Exposes exactly 4 tools (`raigal_scan`, `raigal_fix`, `raigal_why`, `raigal_baseline`).
- **Dependencies:** No new external npm dependencies required. Node built-ins (`node:crypto`, `node:path`, `node:fs`, `node:os`) and existing packages (`zod/v4`, `yaml`, `micromatch`) are sufficient.
