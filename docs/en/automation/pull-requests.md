---
description: "How to configure the Raigal Hybrid GitHub App and Quality Gate, enforce branch protection, and monitor PRs on the Kanban board."
icon: git-pull-request
---

# Pull Request Quality Gate & Kanban

Integrate Raigal into your Pull Request lifecycle to automatically enforce quality thresholds, detect AI slop, block merge hazards before they hit your main branch, and stream live PR evaluations directly onto the Raigal Cloud Kanban board.

---

## Architecture: Hybrid GitHub App + Actions Model

Raigal employs an enterprise-grade **Hybrid Architecture** combining the best of both GitHub Apps and GitHub Actions:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GitHub Ecosystem                              │
│                                                                        │
│   1. Developer opens PR / pushes commit                                │
│          │                                                             │
│          ▼                                                             │
│   GitHub Webhook ──────────────────────────┐                           │
│          │                                 │                           │
│          ▼ (triggers CI)                   │ (pull_request event)      │
│   GitHub Actions Runner                    │                           │
│     • Runs AST Lint & Slop Scans           ▼                           │
│     • Computes diff & score        Raigal Cloud Control Plane          │
│     • Zero code leaves runner       (https://app.raigal.dev)           │
│          │                                 │                           │
│          ▼ (POST /v1/runs)                 │ 2. Creates Pending Check  │
│   Ingest Metrics & Head SHA                │    "Raigal Quality Gate"  │
│          │                                 ▼                           │
│          └─────────────────────────► Resolves Check Run                │
│                                      (Success / Failure + Summary)     │
│                                            │                           │
│                                            ▼                           │
│   Branch Protection Enforced ◄─────────────┘                           │
│   Instant Kanban Board Card Updated                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Why Hybrid?
- **Compute Isolation**: Your proprietary source code stays 100% inside your GitHub Actions runner or sandbox. No source code is ever cloned, transferred, or stored on Raigal Cloud servers.
- **Immediate Pending Feedback**: The moment a PR is opened or updated, the GitHub App automatically registers a `"Raigal Quality Gate"` check run in `in_progress` status on the commit head SHA and creates the PR card on your Kanban board.
- **Native Branch Protection**: The `"Raigal Quality Gate"` check appears directly in your repository's Branch Protection settings as an enforceable required check.
- **Automated Merge & Close Detection**: When a PR is merged or closed, GitHub delivers the event directly to the Raigal App webhook, instantly updating the board without requiring extra CI jobs or manual pings.

---

## Setup Option 1: GitHub App + Actions (Recommended)

Follow this setup to enable native GitHub status checks, immediate pending state, and automated merge tracking.

{% stepper %}

{% step %}
### Create & Register the GitHub App
1. Navigate to your GitHub account or organization **Settings** > **Developer Settings** > **GitHub Apps** > **New GitHub App**.
2. Set the following fields:
   * **GitHub App name**: `Raigal Quality Gate` (or `Raigal - [Your Org]`)
   * **Homepage URL**: `https://app.raigal.dev`
   * **Webhook URL**: `https://app.raigal.dev/api/webhooks/github`
   * **Webhook secret**: Generate a secure secret string (e.g. `openssl rand -hex 20`).
3. Under **Repository permissions**, configure:
   * **Checks**: `Read and write` (required to post and update the check run)
   * **Pull requests**: `Read and write` (required to detect PR opens, synchronizations, and closures)
   * **Metadata**: `Read-only` (default)
4. Under **Subscribe to events**, check:
   * **Pull request**
   * **Installation** and **Installation target**
5. Click **Create GitHub App**.
6. Generate a **Private key** and save the `.pem` file. Note the numeric **App ID**.
{% endstep %}

{% step %}
### Connect GitHub App to Raigal Cloud
Provide your GitHub App credentials to your Raigal Cloud instance (or configure them in your deployment environment):
* `GITHUB_APP_ID`: Your numeric App ID.
* `GITHUB_APP_WEBHOOK_SECRET`: The webhook secret chosen during registration.
* `GITHUB_APP_PRIVATE_KEY_B64`: Your private key `.pem` encoded in base64 (`cat key.pem | base64`).
{% endstep %}

{% step %}
### Install the App in Your Repository
1. In your GitHub App's settings, click **Install App** in the left sidebar.
2. Select your account or organization and choose **All repositories** or select specific target repositories.
3. Click **Install**.
{% endstep %}

{% step %}
### Configure GitHub Actions Workflow
Create `.github/workflows/raigal.yml` in your repository:

```yaml
name: Raigal Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  gate:
    name: Code Quality & Slop Gate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Enables Zero-Token GitHub OIDC

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          # CRITICAL: fetch-depth: 0 ensures full git history is fetched
          # so Raigal can compute accurate diffs against the base branch.
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run Raigal Quality Gate
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="success" %}
**Zero Extra Steps Needed on Merge:** Because the GitHub App receives `pull_request.closed` webhooks natively, you do not need any secondary workflow or `report-pr-closed` script! When the PR is merged or closed, your Kanban board reflects the change automatically.
{% endhint %}
{% endstep %}

{% step %}
### Enable Branch Protection
1. In your GitHub repository, go to **Settings** > **Branches**.
2. Click **Add branch ruleset** or edit your branch protection rule for `main`.
3. Check **Require status checks to pass before merging**.
4. In the search box, select **Raigal Quality Gate**.
5. Save changes. Now, PRs cannot be merged unless Raigal passes!
{% endstep %}

{% endstepper %}

---

## Setup Option 2: Standalone GitHub Actions (No App)

If your organization cannot install GitHub Apps, Raigal operates cleanly via GitHub Actions alone using direct API telemetry.

{% stepper %}

{% step %}
### Configure Secrets in GitHub
In **Settings** > **Secrets and variables** > **Actions**, add:
* `RAIGAL_TOKEN`: Your API key (`rgl_live_...`) copied from [Raigal Cloud Settings](https://app.raigal.dev).
* `RAIGAL_API_URL`: (Optional) `https://app.raigal.dev` if not using the default cloud.
{% endstep %}

{% step %}
### Add CI Workflow
Add `.github/workflows/raigal.yml` with the workflow shown in Option 1.
{% endstep %}

{% step %}
### (Optional) Add PR Closure Sync Workflow
Without the GitHub App, you can optionally notify Raigal Cloud when a PR is merged or closed using a lightweight job:

```yaml
name: Raigal PR Lifecycle

on:
  pull_request:
    types: [closed]

jobs:
  sync-pr-closed:
    name: Sync Closed PR Status
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Report PR Closure to Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal report-pr-closed \
            --pr ${{ github.event.pull_request.number }} \
            ${{ github.event.pull_request.merged && '--merged' || '' }}
```
{% endstep %}

{% endstepper %}

---

## Monitoring PRs on the Remediation Kanban

Once configured, open [Raigal Cloud](https://app.raigal.dev) to track Pull Requests in real time:

1. **Active Cards**: Every evaluated PR appears in the **PULL REQUESTS** column.
   * **Passed Gate**: Highlights in green with overall quality score (e.g. `94/100`), author login, source branch, and target branch.
   * **Merge Blocked**: Highlights in red with blocker count and warning tags.
2. **Contextual Drawer**:
   * Click any PR card to slide open the **Pull Request Drawer**.
   * Inspect all **Blocking Findings** with exact rule IDs, file paths, and offending lines.
   * Review **Diff Statistics** (+additions, -deletions, files changed).
   * Inspect the formatted **Unified Diff Preview**.
   * One-click **Copy git checkout** command to inspect the branch locally, or **Open on GitHub** to jump to the PR.

---

## Handling PRs from Public Forks

{% hint style="danger" %}
**Fork Security:** GitHub Actions automatically suppresses repository secrets (`${{ secrets.RAIGAL_TOKEN }}`) on `pull_request` runs from external forks to prevent secret leakage.
{% endhint %}

If your repository accepts pull requests from public forks, use **GitHub Actions OIDC**:

```yaml
permissions:
  contents: read
  id-token: write  # Required for Zero-Token OIDC
```

When `id-token: write` is set, the Raigal CLI automatically mints a short-lived OIDC token and sends it in the `X-GitHub-OIDC` header. Raigal Cloud verifies the cryptographic JWT against GitHub's public OIDC provider (`token.actions.githubusercontent.com`) and confirms that the repository owner is in your organization's allowed owners allowlist. No static secrets are needed.

---

## Troubleshooting Guide

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Check shows Pending indefinitely** | CI workflow hasn't run or timed out | Verify that your GitHub Actions workflow ran successfully for the commit `head_sha`. Raigal Cloud automatically sweeps orphaned pending checks after 20 minutes. |
| **Check Run not appearing on PR** | GitHub App missing Checks permission | Verify in GitHub App settings that **Checks: Read and write** is enabled and the App is installed on the target repository. |
| **HTTP 401 on GitHub Webhooks** | Mismatched Webhook Secret | Ensure `GITHUB_APP_WEBHOOK_SECRET` matches the secret configured in the GitHub App developer settings. |
| **HTTP 403 `owner_not_allowed` in CI** | Repo owner isn't synced to Raigal allowlist | Go to **Settings > Allowed Owners** in Raigal Cloud and click **Sync GitHub**. |
| **Diff preview shows 0 files changed** | Shallow checkout (`fetch-depth: 1`) | Add `fetch-depth: 0` to your `actions/checkout@v4` step so full git history is available for diffing against the base branch. |
| **PR card doesn't update on merge** | Webhook missing or non-app mode | If using the GitHub App, ensure `pull_request` events are enabled in App subscriptions. If using standalone Actions, add the `report-pr-closed` lifecycle workflow. |
