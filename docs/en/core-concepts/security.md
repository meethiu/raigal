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

## Setting `RAIGAL_TOKEN`

In CI/CD environments, headless Docker containers, or automated scripts, provide authentication via the `RAIGAL_TOKEN` environment variable.

{% hint style="info" %}
`RAIGAL_TOKEN` takes immediate precedence over `~/.raigal/credentials.json`.
{% endhint %}

{% tabs %}
{% tab title="GitHub Actions" %}
```yaml
- name: Run Raigal Scan
  env:
    RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
  run: npx @methiu/raigal scan .
```
{% endtab %}

{% tab title="Terminal (macOS/Linux)" %}
```bash
export RAIGAL_TOKEN="rgl_live_your_token_here"
npx @methiu/raigal whoami
```
{% endtab %}

{% tab title="Windows PowerShell" %}
```powershell
$env:RAIGAL_TOKEN="rgl_live_your_token_here"
npx @methiu/raigal whoami
```
{% endtab %}
{% endtabs %}

## Cryptographic Offline Leases (Ed25519)

Raigal does **not** phone home on every single file scan:
1. When you authenticate via `raigal login` or with `RAIGAL_TOKEN`, the cloud server signs a JWT entitlement using an Ed25519 private key (`RAIGAL_PRIVATE_KEY`).
2. The CLI verifies this signature offline using the bundled public key (`src/cloud/keys.ts`).
3. The valid lease is cached at `~/.raigal/entitlement.json` for up to 72 hours, ensuring uninterrupted scanning during flights, offline periods, or air-gapped dev environments.
