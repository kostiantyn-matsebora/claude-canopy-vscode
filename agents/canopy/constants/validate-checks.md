# Validate Checks

## Errors (framework violations)

- `skill.md` contains inline JSON, YAML, tables, scripts, or code blocks → must extract to category files
- Any tree node (including `Report:`, natural language steps, op descriptions) contains inline fixed text → must extract to `constants/`
- Any tree node (including `Report:`, natural language steps, op descriptions) contains inline parameterised text with `<token>` slots → must extract to `templates/`
- `## Tree` section is missing (skill has only prose or `## Steps`)
- `EXPLORE` is not the first tree node when `## Agent` is present
- `schemas/explore-schema.json` missing when `## Agent` declares `**explore**`
- A framework primitive (`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`) is defined in skill-local or project ops
- Tree node uses `→` for output capture instead of `>>`
- Inline branch notation `IF << X → action` instead of `IF << X` with nested child node
- `Ask: "..."` prose pattern instead of `ASK << question | options`
- `Show Plan (...)` or `Show plan:` prose instead of `SHOW_PLAN >> fields`
- `VERIFY_EXPECTED` referenced but `verify/verify-expected.md` absent
- Op calls in tree are not `ALL_CAPS`
- `## Rules` or `## Response:` section missing
- `skill.md` tree nodes or `Read` references contain hardcoded platform paths (`.claude/` or `.github/`) — skills must be platform-agnostic; all category file references must be relative to the skill directory
- Tree node contains a complex inline command invocation (multi-flag or multi-argument shell command) → must extract to a `commands/` script
- `## Agent` body contains an inline mapping, table, or enumeration (e.g. `.claude/ → claude`, `X → Y` pairs, list of filenames) → extract to `constants/`
- `## Agent` body contains inline quoted examples (e.g. `"create for copilot"`) → extract to `constants/`

## Warnings

- Tree node is a long or complex prose sentence that cannot be read at a glance → extract to a named op in `ops.md`
- `## Agent` section contains boilerplate ("do not inline-read", "return JSON only") → remove; it's implicit
- Tree nodes with multiple clauses joined by `;` or ` — ` → split into step hierarchy
- Conditional prose in steps (`if X: do Y`) instead of `IF` tree node
- `Read <category>/<file>` references all front-loaded at tree top instead of point-of-use
- `## Steps` section used instead of `## Tree`
- `ops.md` has branching prose that should use tree notation internally
- `## Agent` body lists schema fields (`Return: X, Y, Z`) — schema is authoritative; omit the list (or add a policy note if emphasis on specific fields is needed)
- `## Agent` body is a single paragraph with ≥2 concerns joined by commas, semicolons, ` — `, or sentences → split into sub-task bullets (shape B) or extract to a named op (shape C)

## Optimizations

- Inline blocks (> 5 lines) that belong in category files
- Narrative prose paragraphs compressible to step list
- `skill.md` exceeds 60 non-frontmatter lines
- Multi-step patterns repeated across skills → candidate for `shared/project/ops.md`
