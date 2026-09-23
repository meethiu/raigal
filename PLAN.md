# Raigal Cloud Kanban: Real Data Wiring & Mock Purge Plan

## Phase 0: Complete Inventory of Mock Bleed-Through & Hardcoded Entities

Audited against `raigal-main` and `raigal-cloud` on 2026-09-23.

---

### 1. References to `mockBoardData`

| File | Line(s) | Usage / Code Snippet |
|---|---|---|
| `raigal-cloud/web/src/data/mockBoardData.ts` | 1-337 | Whole file defines mock datasets (`MEDIUM_VULNERABILITIES`, `HIGH_VULNERABILITIES`, `PULL_REQUEST_GATES`, `AGENT_REMEDIATIONS`, `INITIAL_BOARD_FINDINGS`) |
| `raigal-cloud/web/src/App.tsx` | 39-44 | `import { MEDIUM_VULNERABILITIES, HIGH_VULNERABILITIES, PULL_REQUEST_GATES, AGENT_REMEDIATIONS, INITIAL_BOARD_FINDINGS } from "./data/mockBoardData";` |
| `raigal-cloud/web/src/App.tsx` | 303 | `return hasRealRuns ? [] : MEDIUM_VULNERABILITIES;` (bleeds mock data when no runs exist or on branch mismatch) |
| `raigal-cloud/web/src/App.tsx` | 318 | `return hasRealRuns ? [] : HIGH_VULNERABILITIES;` (bleeds mock data) |
| `raigal-cloud/web/src/App.tsx` | 325 | `return hasRealRuns ? [] : PULL_REQUEST_GATES;` (bleeds mock PR gates) |
| `raigal-cloud/web/src/App.tsx` | 332 | `return hasRealRuns ? [] : AGENT_REMEDIATIONS;` (bleeds mock agent PRs) |

---

### 2. Hardcoded Model & Engine Names ("Claude 3.5 Sonnet", "AST-Transformer", etc.)

| File | Line(s) | Hardcoded Value |
|---|---|---|
| `raigal-cloud/src/server/routes/v1-runs.ts` | 299 | `agent_engine: "AST-Transformer + Claude 3.5 Sonnet"` (hardcoded in backend aggregation) |
| `raigal-cloud/web/src/data/mockBoardData.ts` | 237 | `agent_engine: "Deterministic AST-Transformer + Claude 3.5 Sonnet"` |
| `raigal-cloud/web/src/data/mockBoardData.ts` | 268 | `agent_engine: "Deterministic AST-Transformer (Zero LLM Tokens)"` |
| `raigal-cloud/web/src/components/cards/AgentRemediationCard.tsx` | 47 | `agentPr.agent_engine.split("+")[1]?.trim() \|\| agentPr.agent_engine` (assumes `AST-Transformer + <Model>` structure) |

---

### 3. Fixed CWE & Threat-Model Paragraphs

| File | Line(s) | Description |
|---|---|---|
| `raigal-cloud/web/src/utils/findingTransformer.ts` | 11-159 | `RULE_CATALOG` object containing hardcoded static `title`, `description`, `threatModel`, `rationale`, and `cveOrCwe` across 18 rules |
| `raigal-cloud/web/src/utils/findingTransformer.ts` | 178-181 | Fallback generic threat model: `isError ? "Potential security risk or runtime failure requiring prompt remediation." : "Code maintainability and readability degradation flagged by static analysis."` |
| `raigal-cloud/web/src/utils/findingTransformer.ts` | 184-210 | Fabricated code snippet comments: `// ${finding.path}:${Math.max(1, finding.line - 2)}`, `// Line ${finding.line}: Flagged by ${finding.rule_id}` |
| `raigal-cloud/web/src/data/mockBoardData.ts` | 18, 32, 46, 61, 84, 98, 112, 127 | Hardcoded static threat model and CWE paragraphs embedded in mock fixtures |

---

### 4. URLs Built with `github.com`

| File | Line(s) | URL Construction |
|---|---|---|
| `raigal-cloud/src/server/routes/v1-runs.ts` | 242 | `const runUrl = (ciObj.run_url as string) \|\| (repo.slug ? \`https://github.com/${repo.slug}/pull/${prNum}\` : undefined);` where `prNum` fell back to `100 + i` (loop index) |
| `raigal-cloud/web/src/components/drawers/PullRequestDrawer.tsx` | 221 | `href={pr.run_url \|\| \`https://github.com/meethiu/raigal/pull/${pr.pr_number}\`}` (hardcoded repo slug `meethiu/raigal`) |
| `raigal-cloud/web/src/components/drawers/AgentDetailsDrawer.tsx` | 186 | `href={\`https://github.com/meethiu/raigal/pull/${agentPr.pr_number}\`}` (hardcoded repo slug `meethiu/raigal`) |
| `raigal-cloud/src/server/lib/github-sync.ts` | 86 | `https://api.github.com/user/orgs` (GitHub API client) |
| `raigal-main/src/cloud/context.ts` | 129, 137 | `process.env.GITHUB_SERVER_URL \|\| "https://github.com"`, `${serverUrl}/${repo}/actions/runs/${runId}` |

---

### 5. Confirmation & Mapping of the 6 Reported Symptoms

1. **Warning/error counts on the board don't add up:**
   - Cause: `raigal-cloud/src/server/routes/v1-runs.ts` (L174-190) queried findings across historical runs capped at 500 without isolating the single latest run for the selected branch.
2. **Board mixes findings from multiple branches:**
   - Cause: Ingestion and aggregation lacked branch-scoped queries (`?branch=...`). Filtering was done client-side over an arbitrarily truncated multi-branch array.
3. **Every `raigal ci` run on the same PR creates a new PR card:**
   - Cause: There was no `pull_requests` table. PR cards were generated at read time by iterating over historical runs; each run generated a separate card with `prNum = 100 + i`.
4. **GitHub PR link goes to the wrong place:**
   - Cause: `v1-runs.ts` (L234, L242) invented `prNum = 100 + i` when git PR was absent or defaulted, and `PullRequestDrawer.tsx` (L221) / `AgentDetailsDrawer.tsx` (L186) hardcoded `meethiu/raigal`.
5. **Cards contain generic boilerplate text:**
   - Cause: `Finding` schema omitted `message`, forcing `findingTransformer.ts` to substitute static catalog blurbs and fake comment lines instead of deterministic rule output.
6. **Agent PR cards show fabricated data:**
   - Cause: `v1-runs.ts` (L285-312) invented model names (`Claude 3.5 Sonnet`), scores (`score - 35`), fake MicroVM logs, and fake diffs because the CLI was not recording agent telemetry into `Run`.

---

## Architecture & Implementation Blueprint

### Phase 1: CLI (`raigal-main`) Telemetry & Contract
1. Extend `Finding` schema in `src/cloud/contract.ts` to include `message: z.string().max(500)`.
2. Extract pure rule message formatter `(rule, matchContext) => string` used by both terminal output and cloud ingest. Enforce secret rules (`redactSource: true` / `isSecretClassRule`) unconditionally format to `FIXED_SECRET_DIAGNOSTIC_MESSAGE`.
3. Add `agent_telemetry` to `Run` contract:
   - `provider: z.string().max(80)` (the actual provider selected)
   - `before_score: z.number().nullable()`
   - `after_score: z.number().nullable()`
   - `pr_url: z.string().url().optional()`
   - `patch_diff: z.string().optional()`
4. Capture `git.pr_number` accurately from `GITHUB_EVENT_PATH` and git diff stats against `base_ref`.
5. Add command `report-pr-closed` (or flag) for minimal closed-event pinging.

### Phase 2: Cloud Backend (`raigal-cloud`)
1. Create `pull_requests` table in `src/db/schema.ts`:
   - `id`: uuid PK
   - `orgId`: varchar references orgs.id
   - `repoId`: uuid references repos.id
   - `prNumber`: integer
   - `title`: varchar
   - `author`: varchar
   - `branch`: varchar
   - `targetBranch`: varchar
   - `status`: varchar ("open" | "closed" | "merged")
   - `score`: integer
   - `passed`: boolean
   - `blockersCount`: integer
   - `runUrl`: varchar
   - `diffSummary`: jsonb
   - `diffPreview`: text
   - `blockingIssues`: jsonb
   - `isAgent`: boolean
   - `agentProvider`: varchar
   - `beforeScore`: integer
   - `afterScore`: integer
   - `patchDiff`: text
   - `latestRunId`: uuid references runs.runId
   - `startedAt`: timestamp
   - `closedAt`: timestamp
   - `updatedAt`: timestamp
   - Unique index on `(org_id, repo_id, pr_number)`
2. In `POST /v1/runs`:
   - Upsert into `pull_requests` using guarded SQL: `ON CONFLICT (org_id, repo_id, pr_number) DO UPDATE ... WHERE excluded.started_at >= pull_requests.started_at`.
   - Maintain latest run per branch in `branch_latest_runs` table/view.
   - Cleanly replace findings for that specific `(repo_id, branch)` from the single latest run.
3. Add `POST /v1/pr-events`:
   - Handles `{ repo, pr_number, event: "closed", merged: boolean }` and updates existing row.
4. Rewrite `GET /v1/runs/repos/:repoId`:
   - Accepts `?branch=...` parameter.
   - Returns findings strictly from the latest completed run for that branch.
   - Returns `pull_requests` directly from the `pull_requests` table.
   - Returns no fabricated data; `null` if telemetry was not recorded.

### Phase 3: Web Dashboard (`raigal-cloud/web`)
1. Purge `mockBoardData.ts` imports from all production code paths.
2. Refactor state into URL parameters:
   - Route path: `/repos/:repoId` (with fallback to query params `?repo=...`).
   - Query params: `?branch=...&drawer=...&item=...`.
   - Sync with `window.history.pushState` on selection; restore state from URL on mount/popstate.
3. `findingTransformer.ts`: Render `finding.message` directly as authoritative rule-authored text.
4. `PullRequestCard.tsx` / `PullRequestDrawer.tsx`:
   - Build GitHub link strictly using helper `buildPrUrl(repo.slug, pr.pr_number)`.
   - Show relative data age ("Updated 2m ago") and staleness warning (>14d).
   - Show closed/merged badges.
5. `AgentRemediationCard.tsx` / `AgentDetailsDrawer.tsx`:
   - Render real `agentProvider` (or "Provider not recorded", never default to Claude).
   - Render real `after_score - before_score`.
6. Replace sidebar mock support tickets with live top rule violations / active engine breakdown.
7. Wire `TopNav` sorting (`severity`, `recent` using actual run timestamp, `rule_id`) into vulnerability lists.
8. Device approval: Show explicit message when account has no organization.
