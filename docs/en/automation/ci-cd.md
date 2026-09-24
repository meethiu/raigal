---
description: "Recipes for integrating Raigal into GitHub Actions, GitLab CI, and automated deployment pipelines."
icon: route
---

# CI/CD Pipelines & GitHub Actions

Enforce clean code, block AI slop at the Pull Request gate, and stream run telemetry directly into the Raigal Cloud Remediation Kanban.

## Environment Variables

When running in CI pipelines, provide the following variables:

| Variable | Required | Description | Example |
|---|---|---|---|
| `RAIGAL_TOKEN` | Yes* | Organization API Key (`rgl_live_...`) | `rgl_live_8f3a9b...` |
| `RAIGAL_API_URL` | Optional | Custom Raigal Cloud endpoint (defaults to standard cloud) | `https://app.raigal.dev` |

*\* Note: When using GitHub Actions with `id-token: write` on enterprise plans, static tokens are optional because Raigal supports Zero-Token GitHub OIDC.*

## GitHub Actions

### 1. Pull Request Quality Gate

Create `.github/workflows/raigal.yml` to gate PRs and report status to the Kanban board:

```yaml
name: Raigal Quality Gate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  gate:
    name: Code Quality & Slop Gate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Enables zero-secret GitHub OIDC authentication!

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Needed to diff PR changes

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run Raigal PR Quality Gate
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL }}
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="tip" %}
**GitHub OIDC Authentication:** Setting `permissions: id-token: write` allows the runner to mint a short-lived OIDC token. Raigal exchanges this token securely via `X-GitHub-OIDC`, eliminating the need to store or rotate static API tokens in repository secrets.
{% endhint %}

### 2. Pull Request Closed & Merged Synchronization

{% hint style="info" %}
**Using the GitHub App?** If you have installed the **Raigal GitHub App**, this step is **not needed**! The App directly receives `pull_request.closed` webhooks from GitHub and updates your Kanban board automatically. See [Pull Request Quality Gate](pull-requests.md) for GitHub App setup.
{% endhint %}

For standalone GitHub Actions environments without the GitHub App, you can synchronize card state when PRs are merged or closed:

```yaml
name: Raigal PR Lifecycle

on:
  pull_request:
    types: [closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Synchronize PR with Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL || 'https://app.raigal.dev' }}
        run: |
          npx @methiu/raigal report-pr-closed --pr ${{ github.event.pull_request.number }} ${{ github.event.pull_request.merged && '--merged' || '' }}
```

## GitLab CI

In `.gitlab-ci.yml`:

```yaml
raigal_gate:
  stage: test
  image: node:22
  variables:
    RAIGAL_TOKEN: $RAIGAL_TOKEN
    RAIGAL_API_URL: $RAIGAL_API_URL
  script:
    - npx @methiu/raigal ci --human
```

## Pull Request Annotations & SARIF

To display findings directly in GitHub's **Security** tab and inline code annotations:

```bash
npx @methiu/raigal scan --sarif > results.sarif
```

Upload using the standard GitHub SARIF upload action (`github/codeql-action/upload-sarif@v3`).
