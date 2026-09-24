---
description: "Run automated worktree repair sessions with local coding agents without risk to your main branch."
icon: robot
---

# Automated Agent Repairs

When static analysis finds issues that require architectural refactoring or semantic code edits, `raigal agent` hands the task to your local AI coding tool inside an **isolated git worktree**.

## The Worktree Guarantee

Raigal never allows an autonomous agent to execute risky mass edits directly on your active working branch.

1. **Isolation:** `raigal agent` spawns a temporary Git worktree (`.git/raigal-worktrees/<session-id>`).
2. **Context Delivery:** The agent provider (Claude Code, OpenCode, or Codex) is invoked with targeted diagnostic context and the exact rule expectations.
3. **Execution & Verification:** The agent edits code and runs test suites inside the worktree.
4. **Publish or Merge:** Once verified, you can review the diff and run `raigal agent apply <session-id>` to merge locally, or let Raigal push a branch and open a Pull Request automatically with `--pr`.

## Supported Providers

Raigal integrates seamlessly with top local AI coding tools:

| Provider | Invocation | Setup Command |
|---|---|---|
| **Claude Code** | `claude` | `raigal agent connect claude` |
| **OpenCode** | `opencode` | `raigal agent connect opencode` |
| **Codex** | `codex` | `raigal agent connect codex` |
| **Auto-Detect** | Automatic selection | `raigal agent use auto` |

Inspect provider availability on your machine anytime:
```bash
raigal agent providers
```

## Workflows

### 1. Interactive Local Repair Session

Test and verify changes locally before making any git commits:

```bash
# Preview what the agent repair session will target
raigal agent plan .

# Start the interactive repair session
raigal agent --provider opencode .

# Check active and recent repair sessions
raigal agent sessions .

# Inspect the diff and diagnostics from a session
raigal agent show <session-id>

# Apply the approved changes back to your working branch
raigal agent apply <session-id>
```

### 2. Autonomous Pull Request Creation (`--pr`)

For completely autonomous remediations, pass `--pr`. Raigal will:
1. Run deterministic fixes and hand remaining issues to the agent provider.
2. Verify that tests pass and the quality score meets `--target-score` (default: 90).
3. Commit the changes to an isolated branch (`raigal/repair-...`).
4. Push the branch to your git remote and open a GitHub Pull Request.
5. Transmit telemetry to Raigal Cloud, registering a card under the **Agent Remediations** column on the Remediation Kanban board.

```bash
raigal agent --provider claude --pr --target-score 95
```

### 3. Lifecycle Synchronization (`report-pr-closed`)

When a remediation PR is reviewed and merged (or closed) on GitHub, the Raigal Cloud Kanban board can be updated automatically using a GitHub Actions trigger:

```yaml
# .github/workflows/raigal-pr-closed.yml
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
      - name: Report PR Closed to Raigal Cloud
        env:
          RAIGAL_TOKEN: ${{ secrets.RAIGAL_TOKEN }}
          RAIGAL_API_URL: ${{ secrets.RAIGAL_API_URL }}
        run: |
          npx @methiu/raigal report-pr-closed --pr ${{ github.event.pull_request.number }} ${{ github.event.pull_request.merged && '--merged' || '' }}
```

{% hint style="success" %}
**Remediation Kanban:** In Raigal Cloud, opening a PR via `raigal agent --pr` creates a card in the **Agent Remediations** column. When the PR is merged, `report-pr-closed` transitions the card to **Merged**, recording score deltas in your organization's telemetry!
{% endhint %}
