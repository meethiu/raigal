# Raigal Integration Contract v2

Save as `docs/integration-contract.md` in both repos. Copy the schema file verbatim to `src/cloud/contract.ts` (CLI) and `src/contract/contract.ts` (cloud). Each repo has a test asserting the file's SHA-256 equals the value in `contract.sha256`, so drift fails CI.

## Auth and conventions

- `Authorization: Bearer <token>`: `rgl_cli_…` (org-bound session) or `rgl_live_…` (org key).
- `X-Raigal-Client: raigal-cli/<version>`.
- In GitHub Actions, `POST /v1/entitlement` also carries `X-GitHub-OIDC: <jwt>` (audience `https://app.raigal.dev`), so the server can verify the repository owner cryptographically.
- Errors: `{ "error": { "code": "<snake_case>", "message": "<human text>" } }`.
- Statuses: 401 `invalid_token` / `oidc_invalid`, 402 `trial_expired`, 403 `forbidden` / `org_suspended` / `owner_not_allowed`, 404 `not_found`, 413 `payload_too_large`, 422 `validation_failed`, 426 `cli_version_unsupported`, 429 `rate_limited`.
- `POST /v1/runs` body limit: 1 MB.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/device/code` | none, rate-limited | start device login |
| POST | `/v1/device/token` | `device_code` in body | poll for approval; returns an org-bound session |
| POST | `/v1/entitlement` | session or org key (+ OIDC in CI) | issue the signed entitlement |
| GET | `/v1/whoami` | session or org key | user, org, plan, trial, allowed owners |
| POST | `/v1/logout` | session | revoke the calling session |
| GET | `/v1/policy?repo=<slug>` | session or org key | resolved policy for the repo |
| POST | `/v1/runs` | session or org key | record a run (idempotent on `run_id`, returns 202) |
| POST | `/webhooks/clerk` | Svix signature | org and membership events |
| POST | `/webhooks/github` | HMAC signature | installation and PR events |
| various | `/api/...` | Clerk session | dashboard API (org scoped; allowlist is read-only for customers) |
| various | `/api/admin/...` | Clerk session + platform admin | orgs, invitations, keys, trials, suspension, allowed owners |

Device flow errors are HTTP 400 with `error` = `authorization_pending`, `slow_down`, `access_denied` or `expired_token`.

## Schemas (Zod v4)

```ts
import { z } from "zod/v4";

export const Severity = z.enum(["error", "warning"]);

export const Finding = z.object({
  rule_id: z.string().max(120),
  engine: z.string().max(40),
  severity: Severity,
  path: z.string().max(500),            // repo-relative, forward slashes
  line: z.number().int().nonnegative(),
  fingerprint: z.string().length(32),   // sha256(rule_id \0 path \0 whitespace-normalised line text), hex, first 32 chars; computed in the CLI
});

export const RepoRef = z.object({
  provider: z.literal("github"),
  slug: z.string().max(200),            // lowercase "owner/name"
  owner_id: z.number().int().optional(),// GitHub numeric owner id when known (OIDC in CI)
  root_commit_hash: z.string().max(64).optional(),
});

export const Step = z.object({
  seq: z.number().int().nonnegative(),
  name: z.string().max(80),             // "engine:ai-slop", "fix:phase-1", "agent:verify", ...
  ok: z.boolean(),
  ms: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number()).optional(),
});

export const Report = z.object({
  score: z.number().min(0).max(100).nullable(),
  scoreable: z.boolean(),
  engine_scores: z.record(z.string(), z.number()).optional(),
  files_scanned: z.number().int().nonnegative(),
  findings: z.array(Finding).max(5000),
});

export const Run = z.object({
  run_id: z.uuid(),                     // client-generated; idempotency key
  command: z.enum(["scan", "ci", "fix", "agent", "hook"]),
  repo: RepoRef,
  owner_verified: z.boolean(),          // true only when proven by GitHub OIDC or a linked App installation
  git: z.object({
    branch: z.string().max(200).optional(),
    head_sha: z.string().max(64).optional(),   // pull_request events: PR head SHA from GITHUB_EVENT_PATH, not GITHUB_SHA
    base_ref: z.string().max(200).optional(),
    pr_number: z.number().int().optional(),
  }),
  ci: z.object({ provider: z.string().max(40), run_url: z.url().max(500).optional() }).optional(),
  flags: z.array(z.string().max(40)).max(40),      // flag NAMES only, never values
  cli_version: z.string().max(40),
  policy: z.object({ version: z.number().int(), hash: z.string().max(64) }).optional(),
  started_at: z.iso.datetime(),
  ended_at: z.iso.datetime(),
  exit_code: z.number().int(),
  steps: z.array(Step).max(200),
  report: Report.optional(),
});

export const Policy = z.object({
  version: z.number().int(),
  hash: z.string().max(64),
  config: z.object({                    // derive from the CLI's real config schema; do not invent keys
    ci: z.object({ failBelow: z.number().min(0).max(100).optional() }).optional(),
    rules: z.record(z.string(), z.enum(["error", "warning", "off"])).optional(),
    exclude: z.array(z.string()).optional(),
  }),
  locked: z.array(z.string()),
});

export const AllowedOwner = z.object({
  id: z.number().int(),                 // immutable GitHub numeric owner id
  login: z.string().max(100),           // lowercase, informational and used for the local check
});

export const EntitlementClaims = z.object({
  iss: z.literal("https://app.raigal.dev"),
  sub: z.string(),                      // org id
  org_name: z.string(),
  plan: z.enum(["trial", "active"]),
  trial_started_at: z.iso.datetime().nullable(),
  trial_ends_at: z.iso.datetime().nullable(),
  allowed_owners: z.array(AllowedOwner).max(50),
  min_cli_version: z.string(),
  iat: z.number().int(),
  exp: z.number().int(),                // about 24h after iat
});
// JWT header: { alg: "EdDSA", typ: "JWT", kid: "<key id>" }. The CLI accepts only EdDSA.

export const EntitlementResponse = z.object({
  entitlement: z.string(),              // compact JWT
  refresh_after: z.number().int(),      // unix seconds, about 12h after iat
});

export const DeviceCodeResponse = z.object({
  device_code: z.string(),
  user_code: z.string(),                // e.g. "WDJB-MJHT", unambiguous alphabet
  verification_uri: z.url(),
  verification_uri_complete: z.url(),
  expires_in: z.number().int(),         // about 600
  interval: z.number().int(),           // 5
});

export const DeviceTokenResponse = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  expires_at: z.iso.datetime(),
  org: z.object({ id: z.string(), name: z.string() }),
  user: z.object({ id: z.string(), email: z.string() }),
});
```

## Semantics

- **Entitlement lease:** TTL about 24h; the CLI refreshes when fewer than 12h remain (at start of a run, not in a way that blocks a valid lease). Cached next to credentials in the state directory. Verified offline against embedded public keys (current and next, selected by `kid`). Reject any `alg` other than EdDSA, unknown `kid`, wrong `iss`, expired beyond grace, or a `min_cli_version` above the running version.
- **Owner check (CLI, local):** the repo owner (lowercased login from the `origin` remote, or `GITHUB_REPOSITORY`) must equal a `login` in `allowed_owners`. No GitHub remote yet: allowed for an interactive member session, recorded as `owner_verified: false`; blocked for org-key runs. Non-GitHub CI providers are unsupported under the allowlist.
- **Owner check (server):** `/v1/runs`, `/v1/policy` and `/v1/entitlement` reject a claimed owner outside the allowlist (`403 owner_not_allowed`). In GitHub Actions the server verifies the OIDC token (GitHub's JWKS, audience, expiry) and requires `repository_owner_id` to be an allowed id; only then is `owner_verified` true.
- **Policy merge order:** org → team → repo → local `.raigal/config.yml`; keys in `locked` cannot be loosened lower down. Every run records `policy.version` and `policy.hash`.
- **Repo identity:** lowercase `owner/name` plus root commit hash; the server upserts on `(org_id, provider, slug)`. New repos start "Unassigned"; "verified" means proven owner (OIDC) or a linked App installation.
- **Idempotency:** `POST /v1/runs` with an existing `run_id` returns 202 without changes.
