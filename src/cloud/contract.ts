import { z } from "zod/v4";

const Severity = z.enum(["error", "warning"]);

export const Finding = z.object({
  rule_id: z.string().max(120),
  engine: z.string().max(40),
  severity: Severity,
  path: z.string().max(500),            // repo-relative, forward slashes
  line: z.number().int().nonnegative(),
  fingerprint: z.string().length(32),   // sha256(rule_id \0 path \0 whitespace-normalised line text), hex, first 32 chars; computed in the CLI
  message: z.string().max(500).optional(),
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

export const AgentTelemetry = z.object({
  provider: z.string().max(80),
  before_score: z.number().min(0).max(100).nullable(),
  after_score: z.number().min(0).max(100).nullable(),
  pr_url: z.string().url().max(500).optional(),
  patch_diff: z.string().max(20000).optional(),
  duration_ms: z.number().int().nonnegative().optional(),
});

export const Report = z.object({
  score: z.number().min(0).max(100).nullable(),
  scoreable: z.boolean(),
  engine_scores: z.record(z.string(), z.number()).optional(),
  files_scanned: z.number().int().nonnegative(),
  findings: z.array(Finding).max(5000),
  agent_telemetry: AgentTelemetry.optional(),
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
    diff_summary: z.object({
      files_changed: z.number().int().nonnegative(),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
    }).optional(),
    diff_preview: z.string().max(10000).optional(),
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
  agent_telemetry: AgentTelemetry.optional(),
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
  iss: z.literal(process.env.RAIGAL_ISSUER?.trim() || "https://app.raigal.dev"),
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
