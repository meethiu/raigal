---
description: "How Raigal computes the 0-100 quality score, weighted penalties, and density-adjusted normalization."
icon: gauge
---

# Scoring Engine

Raigal evaluates codebases on a continuous scale from **0 to 100**, where 100 represents immaculate code quality.

## Score Bands

| Score Range | Status | Interpretation | Exit Code in CI |
|---|---|---|---|
| **90 – 100** | **Healthy** | Clean architecture, no critical defects, zero slop. | `0` (Pass) |
| **75 – 89** | **Warning** | Minor formatting, trivial comments, or mild debt. | `0` (Pass unless threshold set) |
| **0 – 74** | **Failing** | Structural issues, high slop density, security warnings. | `1` (Gate Blocked) |

## Calibrated Scoring Formula

Unlike naive linters that deduct 5 points for every error and quickly reach 0 on large codebases, Raigal implements **density-aware logarithmic scaling**:

$$D = \frac{\sum (\text{weight}_i \times \text{severity}_i)}{\text{KLOC}}$$

Where:
- $\text{KLOC}$ is the total physical lines of code divided by 1,000.
- Rules carry configurable weight multipliers (e.g., Security findings carry heavy weights; trivial comment deductions taper smoothly).
- Files smaller than 100 lines use smoothed baseline denominators to avoid skewing small commits.

## Category Weights

1. **Security & Vulnerabilities (Weight 1.5x)**: Secret leakage, SQL injections, insecure deserialization.
2. **AI Slop Antipatterns (Weight 1.2x)**: Defensively redundant null checks, fake fallbacks, repetitive comments.
3. **Architecture & Boundaries (Weight 1.0x)**: Circular imports, illegal cross-module references.
4. **Code Quality & Complexity (Weight 0.9x)**: Excessive cyclomatic complexity, dead code branches.
5. **Formatting & Style (Weight 0.6x)**: Indentation and whitespace inconsistencies.
