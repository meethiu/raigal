---
description: "How to install the Raigal CLI via npm, npx, or standalone binary across macOS, Linux, and Windows."
icon: download
---

# Installation

Raigal can be executed instantaneously without a permanent installation, or installed globally or per-repository.

## Requirements

- **Node.js**: Version 20.12 or higher (Node 22 LTS recommended).
- **Package Managers**: Compatible with `npm`, `pnpm`, `yarn`, and `bun`.
- **Operating Systems**: macOS, Linux, and Windows (PowerShell & cmd.exe).

## Quick Execution (`npx`)

The fastest way to run Raigal without polluting your global environment:

```bash
npx @methiu/raigal scan .
```

## Global Installation

For instant terminal access with the `raigal` binary:

{% tabs %}
{% tab title="npm" %}
```bash
npm install -g @methiu/raigal
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add -g @methiu/raigal
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn global add @methiu/raigal
```
{% endtab %}
{% endtabs %}

Verify your installation:

```bash
raigal version
# Output: @methiu/raigal v1.0.0 (or current release)
```

## Project Dependency

To lock Raigal within your project team's dependencies:

```bash
pnpm add -D @methiu/raigal
```

Add an npm script to your `package.json`:

```json
{
  "scripts": {
    "scan": "raigal scan .",
    "gate": "raigal ci ."
  }
}
```
