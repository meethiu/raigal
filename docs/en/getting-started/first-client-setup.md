---
description: "Step-by-step onboarding guide for organization admins and enterprise clients."
icon: building
---

# First Client Setup

This guide walks through setting up Raigal for an enterprise client or organization team from scratch.

## Responsibilities Overview

| Task | Responsible Party | Notes |
|---|---|---|
| **Create Organization & Entitlements** | Platform Admin | Performed in Raigal Cloud Dashboard |
| **Generate API Key (`rgl_live_...`)** | Platform Admin | Displayed once; used for CI/CD |
| **Invite Team Members** | Organization Admin | Via Clerk OAuth / Email invitations |
| **Local CLI Sign-In** | Client Developers | Run `raigal login` in their terminal |
| **CI/CD Quality Gate** | DevOps / Repo Admins | Configure `RAIGAL_TOKEN` in CI secrets |

## Platform Admin Actions (Your Role)

1. **Access the Admin Portal:**
   Sign in to your Raigal Cloud instance at `https://your-raigal-instance.herokuapp.com` with an account listed in `PLATFORM_ADMIN_USER_IDS`.

2. **Provision the Organization:**
   - Create organization profile (e.g., `Acme Corp`).
   - Assign subscription tier: `team` or `enterprise`.
   - Set seat allocation and feature flags.

3. **Generate CI/CD API Key:**
   - Navigate to **API Keys** and generate a token with prefix `rgl_live_`.
   - Safely transmit this token to the client's DevOps administrator.

## Client Team Actions (Their Role)

### Developer Local Setup
Each developer runs:

```bash
npx @methiu/raigal login
```

This opens a browser window for Clerk OAuth authentication. Once authenticated, credentials and an Ed25519 offline lease token are cached locally at `~/.raigal/credentials.json` (mode `0600`), enabling offline scanning for up to 72 hours.

Verify login status anytime:
```bash
npx @methiu/raigal whoami
```

### Hook Installation for Coding Agents
To automatically prevent AI slop from entering the repo as developers code with Claude Code, Cursor, or OpenCode:

```bash
npx @methiu/raigal hook install
```
