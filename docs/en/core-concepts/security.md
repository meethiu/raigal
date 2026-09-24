---
description: "Security model, credential storage, RAIGAL_TOKEN resolution, and offline Ed25519 signing."
icon: lock
---

# Security Model & Credentials

Raigal is built with zero-trust principles, cryptographic offline verification, and strict secret hygiene.

## Credential Storage

On local developer environments, user credentials and offline leases are isolated in the user's home directory:

- **Path:** `~/.raigal/credentials.json`
- **File Mode:** `0600` (POSIX user-only read/write; group and world permissions are blocked).
- **Structure:**
  ```json
  {
    "token": "rgl_sess_...",
    "org": { "id": "org_123", "name": "Acme Corp" },
    "user": { "id": "user_456", "email": "dev@acme.com" },
    "created_at": "2026-09-23T12:00:00.000Z"
  }
  ```

## Setting `RAIGAL_TOKEN` & `RAIGAL_API_URL`

In CI/CD environments, headless Docker containers, or automated scripts, provide authentication and endpoint configuration via environment variables:

- `RAIGAL_TOKEN`: Your organization's live API token (`rgl_live_...`). Takes immediate precedence over `~/.raigal/credentials.json`.
- `RAIGAL_API_URL`: (Optional) Explicit backend endpoint (e.g., `https://app.raigal.dev`).

{% tabs %}
{% tab title="GitHub Actions" %}
```yaml
- name: Run Raigal Scan
  env:
    RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
    RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
  run: npx @methiu/raigal scan .
```
{% endtab %}

{% tab title="Terminal (macOS/Linux)" %}
```bash
export RAIGAL_TOKEN="rgl_live_your_token_here"
export RAIGAL_API_URL="https://app.raigal.dev"
npx @methiu/raigal whoami
```
{% endtab %}

{% tab title="Windows PowerShell" %}
```powershell
$env:RAIGAL_TOKEN="rgl_live_your_token_here"
$env:RAIGAL_API_URL="https://app.raigal.dev"
npx @methiu/raigal whoami
```
{% endtab %}
{% endtabs %}

## Telemetry Secret Scrubbing & Data Hygiene

Raigal enforces strict data hygiene before telemetry ever leaves your workstation or is written to the cloud:

1. **In-Flight Scrubbing:** The CLI automatically sanitizes telemetry payloads, redacting authorization headers, bearer tokens, AWS credentials, and common secret patterns before queuing.
2. **Zero-Code Ingestion:** Telemetry only transmits aggregate diagnostic counts, rule names, file paths, and score deltas. Your actual proprietary source code is never uploaded to Raigal Cloud.
3. **Database Guardrails & Zero-Mock Guarantee:** The cloud backend stores telemetry directly into relational PostgreSQL tables (`telemetry_runs`, `pull_requests`) with guarded, idempotent upserts (`ON CONFLICT`). In-memory mock stores are forbidden in production.

## Zero-Token GitHub Actions OIDC Entitlement

For enterprise environments running GitHub Actions, Raigal eliminates the security liability of long-lived static tokens:

1. Configure `permissions: id-token: write` on your GitHub Actions workflow job.
2. The GitHub runner generates a signed OIDC JSON Web Token (JWT) attesting to repository owner, repo name, ref, and workflow identity.
3. Raigal sends this token via the `X-GitHub-OIDC` header to `/api/v1/telemetry/runs`.
4. Raigal Cloud verifies the cryptographic signature directly with GitHub's OIDC provider (`https://token.actions.githubusercontent.com`) and confirms that the repository owner is registered under your organization's entitlement before ingesting run results.

## Cryptographic Offline Leases (Ed25519)

Raigal does **not** phone home on every single file scan:

1. When you authenticate via `raigal login` or with `RAIGAL_TOKEN`, the cloud server signs a JWT entitlement using an Ed25519 private key (`RAIGAL_PRIVATE_KEY`).
2. The CLI verifies this signature offline using the bundled public key (`src/cloud/keys.ts`).
3. The valid lease is cached at `~/.raigal/entitlement.json` for up to 72 hours, ensuring uninterrupted scanning during flights, offline periods, or air-gapped dev environments.
