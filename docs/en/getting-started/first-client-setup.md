---
description: "Step-by-step onboarding guide for organization admins and enterprise clients."
icon: building
---

# First Client Setup

This guide walks through setting up Raigal for an enterprise client or engineering organization from scratch.

## Responsibilities Overview

| Task | Responsible Party | Notes |
|---|---|---|
| **Create Organization & Entitlements** | Platform Admin | Managed in the Raigal Cloud platform |
| **Obtain API Key (`rgl_live_...`)** | Organization Admin | Accessible in the **Settings** view |
| **Configure `RAIGAL_API_URL`** | Organization Admin / DevOps | Points to your dedicated Raigal Cloud instance |
| **Invite Team Members** | Organization Admin | Via Clerk OAuth / Email invitations in Settings |
| **Local CLI Sign-In** | Client Developers | Run `raigal login` in terminal |
| **CI/CD Quality Gate** | DevOps / Repo Admins | Configure `RAIGAL_TOKEN` and `RAIGAL_API_URL` in CI secrets |

## Platform Navigation & Settings

The Raigal Cloud web dashboard provides a streamlined interface:

- **Overview:** The 4-column Remediation Kanban board (Medium Priority, High Risk, Pull Requests CI Gates, Agent Remediations).
- **Activity:** Real-time stream of all repository scans, agent sessions, and quality score transitions.
- **Settings:** Organization configuration, credentials, and account settings.
- **Docs:** Quick access to the complete GitBook documentation suite.
- **⌘K Command Palette:** Instant repository search, branch switching, and quick navigation.

### The Settings Dashboard

In **Settings**, organization administrators can configure integrations:

1. **Raigal API Token:**
   - Displays the active organization token (`rgl_live_...`).
   - Includes a secure masking toggle (`••••••••` vs plain text).
   - Copy button always places the unmasked token string onto the clipboard.
2. **Raigal API URL:**
   - Displays the active backend URL (e.g., `https://app.raigal.dev`).
   - One-click copy for pasting into CI/CD configurations.
3. **Command Line Integration Snippet:**
   - Provides ready-to-copy shell export commands:
     ```bash
     export RAIGAL_TOKEN="rgl_live_..."
     export RAIGAL_API_URL="https://app.raigal.dev"
     ```
4. **Clerk User Profile & Account Settings:**
   - Direct button to launch the Clerk modal for updating email, password, multi-factor authentication (MFA), and organization profile.

## Client Developer Setup

### 1. Local CLI Authentication
Each developer can authenticate using their browser:

```bash
npx @methiu/raigal login
```

This initiates an OAuth flow. Upon successful authentication, credentials and an Ed25519 offline lease token are cached locally at `~/.raigal/credentials.json` (mode `0600`), enabling offline scanning for up to 72 hours.

For headless environments or automated dotfiles, sign in with a token directly:
```bash
echo "rgl_live_..." | npx @methiu/raigal login --with-token
```

Verify status anytime:
```bash
npx @methiu/raigal whoami
```

### 2. Hook Installation for Coding Agents
To automatically intercept and prevent AI slop as developers write code with Claude Code, Cursor, or OpenCode:

```bash
npx @methiu/raigal hook install
```
