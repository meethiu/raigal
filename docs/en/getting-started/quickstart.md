---
description: "Run your first scan, inspect findings, and apply deterministic fixes in 60 seconds."
icon: bolt
---

# Quickstart

Start scanning your repository immediately with three simple steps.

{% stepper %}
{% step %}
### Initialize configuration

Run the initialization wizard to create a calibrated configuration file:

```bash
raigal init .
```

This creates:
- `.raigal/config.yml`: Core scoring threshold, engine toggles, and ignore paths.
- `.raigal/rules.yml`: Specific rule severity overrides.
{% endstep %}

{% step %}
### Run a scan

Execute the scan command in your repository root:

```bash
raigal scan .
```

Raigal runs formatting, linting, quality, and AI-slop engines in parallel and outputs an interactive report with your quality score (0–100):

```text
╭───────────────────────────────────────────────────╮
│  Raigal Quality Score: 94 / 100 [Healthy]         │
╰───────────────────────────────────────────────────╯
Category breakdown:
  • AI Slop:       98/100 (1 finding)
  • Lint & Format: 92/100 (3 findings)
  • Security:      100/100 (Clean)
```
{% endstep %}

{% step %}
### Automatically fix issues

Apply deterministic fixes for formatting, trivial comments, and dead imports:

```bash
raigal fix .
```

For findings that require LLM reasoning, Raigal generates an isolated worktree repair plan for Claude Code, Cursor, or OpenCode via `raigal agent .`.
{% endstep %}
{% endstepper %}
