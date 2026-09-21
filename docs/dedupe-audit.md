# Diagnostic Deduplication Audit

## Overview

This audit analyzes diagnostic overlap across scanning engines in Raigal. When multiple engines or lint rules flag the same root cause on the same line of code, duplicate findings double-penalize repositories and artificially depress quality scores.

Raigal addresses this through a two-tiered strategy:
1. **Config Layer**: When authoritative engines are active, overlapping linters are configured to disable their heuristic approximations (e.g., oxlint disables `no-eval` and `no-implied-eval` when the `security` engine is enabled).
2. **Dedupe Layer**: A data-driven equivalence table applied in the orchestrator pipeline (`src/engines/equivalence-dedupe.ts`) collapses overlapping findings on the same `(file, line)`. The winner is chosen by severity rank (`error` > `warning` > `info`), with ties awarded to the native Raigal rule. Non-overlapping rules on the same line are preserved.

---

## 1. Repository Audit (Raigal Codebase)

A full scan of the Raigal repository with all engines enabled produced the following multi-diagnostic sites:

| Location | Diagnostics | Classification | Resolution Rationale |
|---|---|---|---|
| `src/mcp/tools.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Each diagnostic reports a distinct duplicate exported identifier at the module level. Line 0 denotes whole-file scope. |
| `src/framework-adapters/astro.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Distinct duplicate exported identifiers. |
| `src/framework-adapters/expo.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Distinct duplicate exported identifiers. |
| `src/framework-adapters/nuxt.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Distinct duplicate exported identifiers. |
| `src/framework-adapters/vite.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Distinct duplicate exported identifiers. |
| `src/framework-adapters/sveltekit.ts:0` | Multiple `[code-quality] knip/duplicates (warning)` | Intentional | Distinct duplicate exported identifiers. |

No overlapping syntax or heuristic duplicates were found in the Raigal codebase itself.

---

## 2. Fixture Repository Audit (Section 1.2)

Scanning the standard fixture suite with intentional AI slop, syntax defects, and security issues revealed the following multi-diagnostic sites:

### 2.1 Clear Duplicates (Mapped in Equivalence Table)

| Location | Rules Reported | Winner | Resolution Mechanism |
|---|---|---|---|
| `src/danger.ts:5` (`eval(q)`) | `[lint] eslint/no-eval (warning)`<br>`[security] security/eval (error)` | `security/eval` | Config layer disables `no-eval` in oxlint when security is enabled; dedupe layer awards precedence to `security/eval` due to higher severity (`error` vs `warning`). |
| `src/slop.ts:2` (`import { readFileSync }`) | `[lint] eslint/no-unused-vars (warning)`<br>`[ai-slop] ai-slop/unused-import (warning)` | `ai-slop/unused-import` | Dedupe layer matches `unused-import` group on import line; tie broken in favor of native Raigal rule (`ai-slop/*`). |
| `src/slop.ts:3` (`import { join }`) | `[lint] eslint/no-unused-vars (warning)`<br>`[ai-slop] ai-slop/unused-import (warning)` | `ai-slop/unused-import` | Dedupe layer matches `unused-import` group; native Raigal rule wins. |
| `src/slop.ts:19` (`catch (e) {}`) | `[lint] eslint/no-empty (warning)`<br>`[ai-slop] ai-slop/swallowed-exception (error)` | `ai-slop/swallowed-exception` | Both flag the empty exception block; `ai-slop/swallowed-exception` wins on severity (`error` > `warning`). |
| `src/slop.ts:21` (`if (true)`) | `[lint] eslint/no-constant-condition (warning)`<br>`[ai-slop] ai-slop/constant-condition (warning)` | `ai-slop/constant-condition` | Both flag the constant conditional; native Raigal rule wins the tie. |
| `py/app.py:4` (`except: pass`) | `[ai-slop] ai-slop/swallowed-exception (error)`<br>`[ai-slop] ai-slop/python-bare-except (warning)` | `ai-slop/swallowed-exception` | Both flag bare except swallowing errors silently; `ai-slop/swallowed-exception` wins on severity (`error` > `warning`). |

### 2.2 Intentional Multi-Rule Sites (Not Deduplicated)

| Location | Rules Reported | Classification | Rationale |
|---|---|---|---|
| `src/slop.ts:19` | `[lint] eslint/no-unused-vars (warning)` (Catch parameter 'e') alongside `ai-slop/swallowed-exception` | Intentional | Unused variable identifier `e` is orthogonal to the empty catch block structure. Even if code is added inside the catch block, `e` remains unused unless referenced. |
| `src/secrets.ts:2` | `[security] security/hardcoded-secret (error)` (two instances) | Intentional | Multiple distinct secret tokens (`awsKey` and `ghToken`) defined on adjacent statements or lines. Each secret requires independent rotation. |

---

## 3. Equivalence Table Specification

Implemented in `src/engines/equivalence-dedupe.ts`:

| Group ID | Rules in Equivalence Group | Tie-Break Rule |
|---|---|---|
| `eval` | `security/eval`, `eslint/no-eval`, `typescript/no-implied-eval`, `eslint/no-implied-eval` | Severity first (`security/eval` error wins); native rule tie-break |
| `unused-import` | `ai-slop/unused-import`, `eslint/no-unused-vars`, `typescript/no-unused-vars` | Severity first; native rule tie-break (`ai-slop/unused-import` wins on import lines) |
| `constant-condition` | `ai-slop/constant-condition`, `eslint/no-constant-condition` | Severity first; native rule tie-break |
| `swallowed-exception` | `ai-slop/swallowed-exception`, `eslint/no-empty`, `ai-slop/python-bare-except` | Severity first (`ai-slop/swallowed-exception` error wins) |
| `duplicate-import` | `ai-slop/duplicate-import`, `import/no-duplicates`, `eslint/no-duplicate-imports` | Severity first; native rule tie-break |
| `unreachable-code` | `ai-slop/unreachable-code`, `eslint/no-unreachable` | Severity first; native rule tie-break |
| `empty-function` | `ai-slop/empty-function`, `eslint/no-empty-function` | Severity first; native rule tie-break |

### Invariants:
1. **Unused variables outside imports are preserved**: A non-import variable flagged by `eslint/no-unused-vars` does not collide with `ai-slop/unused-import`, because the latter only triggers on import statements.
2. **Unrelated rules on the same line are preserved**: Two diagnostics on the same line belonging to different groups (or unmapped rules) remain untouched.
3. **Deterministic output**: Engine output ordering and stable tie-breaks guarantee identical scores and diagnostics across repeated runs.
