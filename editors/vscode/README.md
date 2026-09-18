# Raigal for VS Code

Surfaces [Raigal](https://github.com/meethiu/raigal) code-quality findings as
diagnostics (squiggles) directly in the editor, plus a status-bar score.

This extension does **not** bundle a scanner. It shells out to the `raigal` CLI
you already have installed and parses its `raigal scan <path> --json` envelope.

## Requirements

Install the CLI globally (or point `raigal.path` at a local binary):

```bash
npm i -g raigal
```

## Features

- Scans the workspace on activation and re-scans a file on save.
- Publishes findings to the `raigal` diagnostic collection with the rule id
  (`engine/rule`) and message at the reported line/column.
- Status-bar item showing the latest score out of 100; click it to re-scan.
- Command **Raigal: Scan Workspace** (`raigal.scanWorkspace`).
- If the CLI is missing, shows a friendly prompt instead of crashing.

## Settings

| Setting             | Default    | Description                          |
| ------------------- | ---------- | ------------------------------------ |
| `raigal.path`       | `"raigal"` | Path to the Raigal CLI executable.   |
| `raigal.scanOnSave` | `true`     | Re-scan a file when it is saved.     |

## Develop

```bash
npm install      # install dev deps (@types/vscode, typescript)
npm run compile  # tsc -> out/extension.js
```

Then press `F5` in VS Code to launch an Extension Development Host with the
extension loaded. The build is fully self-contained: this package has its own
`package.json` and `tsconfig.json` and is not part of the root raigal build.
