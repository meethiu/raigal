---
description: "Recipes for integrating Raigal into GitHub Actions, GitLab CI, and automated deployment pipelines."
icon: route
---

# CI/CD Pipelines & GitHub Actions

Enforce clean code and block AI slop at the Pull Request gate.

## GitHub Actions

Create `.github/workflows/raigal.yml`:

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
        run: |
          npx @methiu/raigal ci --changes --base origin/${{ github.base_ref || 'main' }} --human
```

{% hint style="tip" %}
**GitHub OIDC:** If your organization uses Raigal Enterprise, setting `permissions: id-token: write` allows Raigal to exchange GitHub runner tokens automatically, eliminating the need to rotate static secret tokens!
{% endhint %}

## GitLab CI

In `.gitlab-ci.yml`:

```yaml
raigal_gate:
  stage: test
  image: node:22
  variables:
    RAIGAL_TOKEN: $RAIGAL_TOKEN
  script:
    - npx @methiu/raigal ci --human
```

## Pull Request Annotations & SARIF

To display findings directly in GitHub's **Security** tab:

```bash
npx @methiu/raigal scan --sarif > results.sarif
```

Upload using the standard GitHub SARIF upload action (`github/codeql-action/upload-sarif@v3`).
