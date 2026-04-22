# VALIDATE

Evaluate a Canopy skill for framework errors, warnings, and optimization opportunities.

1. Locate the skill directory using Glob.
2. Read all files: `skill.md`, `ops.md` (if present), all category subdir files.
3. Read `policies/authoring-rules.md` for structural, style, op naming, subagent, and debug-awareness constraints.
   Read `constants/control-flow-notation.md` for ad-hoc control flow patterns to detect.
   Read `constants/category-dirs.md` and `policies/category-decision-flowchart.md` for category classification.
   All checks derived from these policies apply to tree nodes in **both** `skill.md` and `ops.md` equally — not just to `skill.md`.
4. Read `constants/validate-checks.md` for the full Error, Warning, and Optimization check catalog. Evaluate the skill against every check. Classify each finding by severity: **Error** (must fix), **Warning** (should fix), **Optimization** (recommended).

   For content-class rules (inline static/parameterised content, complex commands), iterate every tree node in order and apply each check explicitly — do not rely on a holistic scan.

5. Report all findings grouped by severity, with line numbers where possible. If no issues: report "Skill passes validation — no issues found."
