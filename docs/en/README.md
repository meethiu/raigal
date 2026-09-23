---
description: "Raigal is the unified code-quality and anti-AI-slop platform designed for modern engineering teams and coding agents."
icon: shield-check
layout:
  width: default
  tableOfContents:
    visible: true
  pagination:
    visible: true
---

# Welcome to Raigal

Raigal is an enterprise-grade code-quality platform and CLI engine that catches the lazy, fragile, or bloated patterns AI coding tools leave behind. It unifies formatting, linting, complexity checks, security audits, and specialized AI-slop detection behind a single command, returning an actionable score from 0 to 100.

{% hint style="success" %}
**Fast & Deterministic:** Raigal scans thousands of files in milliseconds using native, high-performance engines and provides automated repair workflows.
{% endhint %}

## Why Raigal?

Generative AI tools (Claude, Cursor, Copilot, ChatGPT) write code fast, but they often introduce:
- **Trivial comments & fluff:** Restating the obvious or repeating function signatures.
- **Defensive hallucinations:** Redundant null-checks or fake polyfills.
- **Silent failure antipatterns:** Empty `catch` blocks or unhandled promise rejections.
- **Architectural drift:** Violating layered boundaries or circular dependencies.
- **Type bypasses:** Indiscriminate use of `any` casts or unvalidated runtime inputs.

Raigal guards your codebase at the local developer hook, in PR reviews, and across your CI/CD pipeline.

## Core Capabilities

<table data-view="cards">
  <thead>
    <tr>
      <th>Feature</th>
      <th>Description</th>
      <th>Link</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>0–100 Scoring Engine</strong></td>
      <td>Density-aware quality scoring calibrated for high-throughput repositories.</td>
      <td><a href="core-concepts/scoring.md">Learn Scoring</a></td>
    </tr>
    <tr>
      <td><strong>13+ Built-in AI Slop Rules</strong></td>
      <td>Deterministic AST and pattern matching to detect AI-generated cruft.</td>
      <td><a href="core-concepts/rules.md">Explore Rules</a></td>
    </tr>
    <tr>
      <td><strong>Real-Time Agent Hooks</strong></td>
      <td>Live interception hooks for Claude Code, Cursor, and OpenCode.</td>
      <td><a href="cli-reference/hooks.md">Configure Hooks</a></td>
    </tr>
    <tr>
      <td><strong>Cloud Platform & Licensing</strong></td>
      <td>Enterprise dashboard, Clerk auth, and Ed25519 offline license verification.</td>
      <td><a href="cloud-platform/architecture.md">Cloud Architecture</a></td>
    </tr>
  </tbody>
</table>

## Next Steps

{% stepper %}
{% step %}
### Install the CLI
Install Raigal via npm, or run it instantaneously using `npx`.
[Installation Guide](getting-started/installation.md)
{% endstep %}

{% step %}
### Run your first scan
Execute `raigal scan .` to get an immediate health score and breakdown of findings.
[Quickstart Guide](getting-started/quickstart.md)
{% endstep %}

{% step %}
### Connect to CI/CD & Cloud
Add the quality gate to GitHub Actions or your preferred CI runner.
[CI/CD Setup](automation/ci-cd.md)
{% endstep %}
{% endstepper %}
