---
description: "Configuring Raigal project rules, score thresholds, and engine parameters via .raigal/config.yml."
icon: gear
---

# Configuration

Raigal uses a typed configuration file located at `.raigal/config.yml` in your repository root.

## Minimal Configuration

```yaml
version: 1

scoring:
  threshold: 85
  fail_under: 80

engines:
  format: true
  lint: true
  quality: true
  ai_slop: true
  security: true
  architecture: true

ignore:
  - "dist/**"
  - "node_modules/**"
  - "**/*.min.js"
```

## Configuration Reference

### `scoring`

- `threshold` (number, default: 80): The target benchmark score for the repository.
- `fail_under` (number, default: 80): Minimum passing score in CI pipelines (`raigal ci`). Any score below this triggers an exit code `1`.

### `engines`

Enables or disables individual diagnostic modules:
- `ai_slop`: Detects repetitive patterns, defensively redundant checks, and hallucinated comments.
- `security`: Scans for exposed tokens, private keys, and insecure function calls.
- `lint`: High-speed lint checks powered by Oxlint and Ruff.
- `format`: Style checks powered by Biome, Gofmt, and Ruff.
- `quality`: Dead code detection (Knip) and cyclomatic complexity limits.
- `architecture`: Project boundary import constraints.

### `telemetry`

Raigal respects developer privacy:
```yaml
telemetry:
  enabled: false
```
*(Telemetry events are strictly anonymous metrics. No code content or file paths are ever transmitted).*
