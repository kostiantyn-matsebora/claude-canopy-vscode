# Authoring Rules

## Skill structure

`SKILL.md` must contain:
- Frontmatter (required: `name`, `description`; optional: `argument-hint`, `license`, `metadata`, `allowed-tools` per the [agentskills.io spec](https://agentskills.io/specification))
- `## Agent`, `## Tree`, `## Rules`, `## Response:` sections
- Op calls and natural language in the tree
- `Read <category>/<file>` references at point of use

`SKILL.md` must NOT contain:
- Tables
- JSON, YAML, or any structured data blocks
- Scripts, shell commands, or code fences with executable content
- Inline examples or templates
- Phase-by-phase prose when a `## Tree` is possible
- Hardcoded platform-specific paths (`.claude/` or `.github/`) in tree nodes or `Read` references — all category file references must be relative to the skill directory (e.g. `policies/rules.md`, not `.claude/skills/my-skill/policies/rules.md`)
- Complex inline command invocations (multi-flag or multi-argument shell commands) — extract to a `commands/` script and invoke it from the tree

`## Tree`, `## Rules`, and `## Response:` sections are all required.
All structured content must be extracted to the appropriate category subdirectory file.
`ops.md` is only written when ops are not already covered by shared.
Category files are only written when content is not already in shared.

## Writing style

Replace narrative paragraphs with numbered or bulleted steps. Each step: one action, one outcome, optionally one `Read <category>/<file>` reference. No multi-sentence explanations inside a step.

Prefer `## Tree` over `## Phase N` sections. Keep phase headings only when steps have complex inter-phase state that cannot be expressed as a flat pipeline. Keep `## Rules` and `## Response:` sections as short bullet lists. Remove subsection headings that are just labels for what follows extracted content.

When `## Steps` is a sequential pipeline with only `IF` branches, replace with `## Tree`.

Steps with multiple clauses joined by `;` or ` — ` must be split into a numbered step header with indented sub-bullets. Each sub-bullet: one action or one condition. No inline chaining.

Standard reference line: `Read \`<category>/<file>\` for <brief description>.` Used at the point in the steps where the content is needed — not all at the top. Load only what's needed for the current branch or action.

## Tree nodes

Tree nodes must be short and scannable. A node that cannot be read at a glance must be extracted to a named op in `ops.md`. The tree should read like a table of contents: short op calls and brief natural-language steps, not verbose inline descriptions.

Tree nodes must not contain inline static or parameterised content:
- Fixed content (no placeholders) → `constants/`
- Parameterised content (contains `<token>` slots) → `templates/`

This applies to all node types — `Report:`, natural language steps, op descriptions, or any other node that embeds literal content inline.

Mechanical behavior (e.g. "patch if path exists, put if new") belongs as a section comment in the resource file itself, not repeated in `SKILL.md` steps. `SKILL.md` states only: which file to read, arguments and captured output values, and exceptions to default behavior (these stay inline).

## Op naming

Replace multi-line blocks expressing a single recognizable operation with a named op.

Lookup order: `<skill>/ops.md` first, then any consumer-defined cross-skill ops, then `framework-ops.md` from the `canopy-runtime` skill (physical path: `../canopy-runtime/references/framework-ops.md`, loaded up-front by the canopy tree).

- Skill-local ops → `<skill>/ops.md`
- Cross-skill project ops → consumer's own packaging (e.g. a dedicated `project-ops` skill they author); no default location
- Framework primitives → `../canopy-runtime/references/framework-ops.md` (ships with the `canopy-runtime` skill)

Named op notation: `OP_NAME << inputs >> outputs`

Conditional branches, multi-step procedures, and decision trees specific to one skill belong in `<skill>/ops.md`. Op definitions use tree notation where branching exists; prose for simple linear ops.

## Subagent contract

If a skill launches a subagent:
- Schema must exist as `schemas/explore-schema.json`.
- "Do not inline-read" and "return JSON only matching schema" are implicit from `../canopy-runtime/references/skill-resources.md` — do not restate.
- No freeform prose output — every field the skill uses must be declared in the schema.
- First tree node must be `EXPLORE >> context` when `## Agent` declares `**explore**`.

### `## Agent` body shape

Three canonical shapes — pick the one matching subagent complexity:

**(A) Minimal** — one concern, one task summary line:

```markdown
**explore** — reads the files for <service>. Output contract: `schemas/explore-schema.json`.
```

**(B) Sub-task bullets** — ≥2 parallel concerns (no ordering between them), each with its own lookup file:

```markdown
**explore** — resolve operation dispatch context. Output contract: `schemas/dispatch-schema.json`.

Sub-tasks:
- Classify intent from `$ARGUMENTS` — see `constants/operation-detection.md`
- Detect execution platform — see `constants/platform-detection.md`
- Resolve explicit target platform — see `constants/target-platform-triggers.md`
```

One concern per bullet. One `constants/<file>.md` reference per bullet. Prose *within* a bullet is allowed but must stay short and scannable.

**(C) Op reference** — procedure has ordering, branching, or data flow between steps; or is reusable across skills:

```markdown
**explore** — execute `FETCH_DISPATCH_CONTEXT`. Output contract: `schemas/dispatch-schema.json`.
```

The op lives in `<skill>/ops.md` (or `<skill>/ops/<named-op>.md` for skills with multi-file op libraries like `canopy`) as a normal tree-form op. Runtime resolves the name and injects the op body as the subagent's task.

### `## Agent` body MUST NOT contain

- Inline mappings, tables, or enumerations (e.g. `.claude/ → claude`, lists of version-bearing filenames) — extract to `constants/`
- Inline quoted examples (e.g. `"create for copilot"`) — extract to `constants/`
- Schema-field lists (e.g. `Return: field1, field2, ...`) — schema is authoritative; omit

### Multi-concern rule (MUST)

When the subagent performs ≥2 distinct concerns, the body MUST use shape (B) or (C). Concerns joined by commas, semicolons, ` — `, or sentences in a single paragraph are not allowed — this mirrors the existing tree-node rule that multi-clause steps must be split into sub-bullets. Single-concern subagents use shape (A).

Shape selection:
- 1 concern → (A)
- ≥2 parallel concerns with no ordering/data dependencies → (B)
- Procedure has ordering, branching, or data flow → (C)

Platform-specific execution (native subagent on Claude Code, inline fallback on Copilot) is defined by the runtime spec — see `../canopy-runtime/references/runtime-claude.md` and `../canopy-runtime/references/runtime-copilot.md`.

## Debug meta-skill

The `debug` skill wraps any target skill via `EXECUTE_WITH_TRACE`. It reads the target skill's tree and executes it while emitting phase banners and node-trace output.

- Never insert debug hooks, `IF << debug_mode` branches, or `TRACE_*` op calls into target skills — debug mode must remain a wrapper, never an intrusion.
- The ops `EMIT_PHASE_BANNER`, `EXECUTE_WITH_TRACE`, `TRACE_NODE`, and `TRACE_EXECUTE_NODES` are skill-local to `debug/ops.md` — do not flag them as unknown ops when validating the `debug` skill.
- During VALIDATE: if a skill contains `IF << debug_mode` or any `TRACE_*` call, flag it as a **Warning**.
