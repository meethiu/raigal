---
description: "Run automated worktree repair sessions with local coding agents without risk to your main branch."
icon: robot
---

# Automated Agent Repairs

When static analysis finds issues that require architectural refactoring or semantic code edits, `raigal agent` hands the task to your local AI coding tool inside an **isolated git worktree**.

## The Worktree Guarantee

Raigal never allows an autonomous agent to execute risky mass edits directly on your active working branch.

1. `raigal agent` spawns a temporary Git worktree (`.git/raigal-worktrees/<session-id>`).
2. The agent provider (Claude Code, Cursor, or OpenCode) is invoked with targeted diagnostic context and the exact rule expectations.
3. The agent edits code and runs test suites inside the worktree.
4. Once verified, you review the diff and run `raigal agent apply <session-id>` to merge the changes.

## Usage

```bash
# Preview what the agent repair session will target
raigal agent plan .

# Start the interactive repair session
raigal agent .

# Check active and recent repair sessions
raigal agent sessions .

# Inspect the changes made by a session
raigal agent show <session-id>

# Apply the approved changes back to your working branch
raigal agent apply <session-id>
```
