# VALIDATE

Evaluate a Canopy skill for framework errors, warnings, and optimization opportunities.

1. Locate the skill directory using Glob.
2. Read all files: `skill.md`, `ops.md` (if present), all category subdir files.
3. Read `policies/skill-structure-rules.md` for structural constraints.
   Read `policies/writing-rules.md` for style and formatting checks.
   Read `policies/op-naming-rules.md` for op naming checks.
   Read `policies/debug-rules.md` for debug-awareness constraints.
   Read `constants/control-flow-notation.md` for ad-hoc control flow patterns to detect.
   Read `constants/category-dirs.md` and `policies/category-decision-flowchart.md` for category classification.
   All checks derived from these policies apply to tree nodes in **both** `skill.md` and `ops.md` equally — not just to `skill.md`.
4. Evaluate the skill. Classify each finding:
   - **Error** — violates a framework rule; must be fixed
   - **Warning** — likely wrong; should be fixed
   - **Optimization** — reduces token/context load; recommended

**Errors (framework violations):**
- `skill.md` contains inline JSON, YAML, tables, scripts, or code blocks → must extract to category files
- Tree node contains a complex inline command invocation (multi-flag or multi-argument shell command) → must extract to a `commands/` script
- `## Tree` section is missing (skill has only prose or `## Steps`)
- `EXPLORE` is not the first tree node when `## Agent` is present
- `schemas/explore-schema.json` missing when `## Agent` declares `**explore**`
- A framework primitive (`IF`, `ELSE_IF`, `ELSE`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`) is defined in skill-local or project ops
- Tree node uses `→` for output capture instead of `>>`
- Inline branch notation `IF << X → action` instead of `IF << X` with nested child node
- `Ask: "..."` prose pattern instead of `ASK << question | options`
- `Show Plan (...)` or `Show plan:` prose instead of `SHOW_PLAN >> fields`
- `VERIFY_EXPECTED` referenced but `verify/verify-expected.md` absent
- Op calls in tree are not `ALL_CAPS`
- `## Rules` or `## Response:` section missing
- `skill.md` tree nodes or `Read` references contain hardcoded platform paths (`.claude/` or `.github/`) — skills must be platform-agnostic; all category file references must be relative to the skill directory

**Warnings:**
- Tree node is a long or complex prose sentence that cannot be read at a glance → extract to a named op in `ops.md`
- `## Agent` section contains boilerplate ("do not inline-read", "return JSON only") → remove; it's implicit
- Tree nodes with multiple clauses joined by `;` or ` — ` → split into step hierarchy
- Conditional prose in steps (`if X: do Y`) instead of `IF` tree node
- `Read <category>/<file>` references all front-loaded at tree top instead of point-of-use
- `## Steps` section used instead of `## Tree`
- `ops.md` has branching prose that should use tree notation internally

**Optimizations:**
- Inline blocks (> 5 lines) that belong in category files
- Narrative prose paragraphs compressible to step list
- `skill.md` exceeds 60 non-frontmatter lines
- Multi-step patterns repeated across skills → candidate for `shared/project/ops.md`

5. Report all findings grouped by severity, with line numbers where possible. If no issues: report "Skill passes validation — no issues found."

**Debug skill awareness:** When validating the `debug` skill itself, the ops
`EMIT_PHASE_BANNER`, `EXECUTE_WITH_TRACE`, `TRACE_NODE`, and `TRACE_EXECUTE_NODES`
resolve from `debug/ops.md` — do not flag them as unrecognized or missing from framework
primitives. When validating any other skill, treat `IF << debug_mode` branches or
`TRACE_*` calls as Warnings (debug awareness must not be baked into target skills).
