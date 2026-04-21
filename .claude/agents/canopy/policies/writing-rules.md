# Writing Rules

## Prose → step lists

Replace narrative paragraphs with numbered or bulleted steps.
Each step: one action, one outcome, optionally one `Read <category>/<file>` reference.
No multi-sentence explanations inside a step.

## Tree nodes → ops

Tree nodes must be short and scannable. A node that contains a long or complex prose sentence — one that cannot be read at a glance — must be extracted to a named op in `ops.md`. The tree should read like a table of contents: short op calls and brief natural-language steps, not verbose inline descriptions.

## Static and parameterised content → constants or templates

Tree nodes must not contain inline static or parameterised content. Any such content must be extracted to a resource file and referenced by name:
- Fixed content (no placeholders) → `constants/`
- Parameterised content (contains `<token>` slots) → `templates/`

This applies to all node types — `Report:`, natural language steps, op descriptions, or any other node that embeds literal content inline.

## Phase structure

Prefer `## Tree` over `## Phase N` sections.
Keep phase headings only when steps have complex inter-phase state that cannot be expressed as a flat pipeline.
Keep `## Rules` and `## Response:` sections as short bullet lists.
Remove subsection headings that are just labels for what follows extracted content.

## Tree format over step lists

When `## Steps` is a sequential pipeline with only `IF` branches, replace with `## Tree`.

## Multi-clause steps → hierarchical sub-bullets

Steps with multiple clauses joined by `;` or ` — ` must be split into a numbered step header with indented sub-bullets.

Before:
```
1. **Check tunnel** — read `commands/commands-cloudflare.ps1` for check command; if tunnel exists capture `id`; if not: proceed to step 2
```

After:
```
1. **Check tunnel**
   - Read `commands/commands-cloudflare.ps1` for check command
   - If tunnel exists: capture `id`
   - If not: proceed to step 2
```

Each sub-bullet: one action or one condition. No inline chaining with `;` or ` — `.

## Reference pattern

Standard reference line: `Read \`<category>/<file>\` for <brief description>.`

Used at the point in the steps where the content is needed — not all at the top.
Load only what's needed for the current branch or action.

## Behavior details in resource files

Mechanical behavior (e.g. "patch if path exists, put if new") belongs as a section comment in the resource file itself, not repeated in `skill.md` steps.

`skill.md` states only:
- Which file to read and which section/operation.
- Arguments and captured output values.
- Exceptions to default behavior (these stay inline — e.g., `[never overwrite]`).
