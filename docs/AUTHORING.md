# Authoring Skills Manually

This document covers writing Canopy skills by hand. For the recommended approach — letting
the `canopy` agent generate, scaffold, or convert skills for you — see the
[Usage section](README.md#usage) in the README.

For a quick one-page reference covering primitives, op syntax, and category directories, see [CHEATSHEET.md](CHEATSHEET.md). For the full specification (tree execution model, notation, primitives table, directory layout), see [FRAMEWORK.md](FRAMEWORK.md).

---

## Skill Anatomy

Every skill is a `skill.md` file with these sections in order:

```markdown
---
name: skill-name
description: One-line description shown in skill picker.
argument-hint: "<required-arg> [optional-arg]"
---

Preamble: $ARGUMENTS — parse and set context variables here.

---

## Agent          ← optional; declares an explore subagent
## Tree           ← execution pipeline (required)
## Rules          ← invariants and safety constraints
## Response:      ← output format declaration
```

### `## Agent`

Declares an `**explore**` subagent. The subagent uses `schemas/explore-schema.json` as its output contract automatically. The first tree node must be `EXPLORE >> context` when `## Agent` is present.

Three canonical shapes — pick the one matching subagent complexity:

**(A) Minimal** — one concern:

```markdown
## Agent

**explore** — reads the files for `<service-name>` under `services/`,
including configs, templates, and existing deployment manifests.
```

**(B) Sub-task bullets** — ≥2 parallel concerns (no ordering between them). Each bullet = one concern + one `constants/<file>.md` reference:

```markdown
## Agent

**explore** — resolve operation dispatch context. Output contract: `schemas/dispatch-schema.json`.

Sub-tasks:
- Classify intent from `$ARGUMENTS` — see `constants/operation-detection.md`
- Detect execution platform — see `constants/platform-detection.md`
- Resolve explicit target platform — see `constants/target-platform-triggers.md`
```

**(C) Op reference** — procedure has ordering, branching, or data flow between steps:

```markdown
## Agent

**explore** — execute `FETCH_DISPATCH_CONTEXT`. Output contract: `schemas/dispatch-schema.json`.
```

The op lives in `ops.md` as a normal tree-form op. The runtime resolves the name and injects the op body as the subagent's task.

**Must not contain:** inline mappings or enumerations, inline quoted examples, or schema-field lists (`Return: X, Y, Z` — the schema is authoritative).

**Multi-concern rule:** when the subagent performs ≥2 concerns, shape (B) or (C) is required — concerns joined by commas, semicolons, ` — `, or sentences in a single paragraph are not allowed. Same rule as for multi-clause tree-node steps.

### `## Tree`

The skill's execution pipeline as a syntax tree. Nodes execute top-to-bottom. Each node
is either an **op call** (`ALL_CAPS`) or **natural language**.

Two equivalent syntaxes are accepted — markdown list (`*` nested lists) or box-drawing (fenced code with tree characters). See [FRAMEWORK.md — Tree Execution Model](FRAMEWORK.md#tree-execution-model) for the execution semantics and both syntax examples. For the `<<`, `>>`, `|` notation reference, see [FRAMEWORK.md — Notation](FRAMEWORK.md#notation).

### `## Rules`

Short bullet list of invariants that apply throughout the skill execution. Do not duplicate
op-level behavior here — these are skill-wide constraints.

---

## Minimal Example

```markdown
---
name: my-skill
description: Does something useful.
argument-hint: "<target>"
---

Target: $ARGUMENTS

---

## Tree

* my-skill
  * SHOW_PLAN >> what will change
  * ASK << Proceed? | Yes | No
  * do the thing

## Rules

- Never overwrite existing files without confirmation

## Response: Summary / Changes / Notes
```

---

## Defining Ops

Ops are named, reusable steps defined in Markdown files. For the 3-tier lookup order (skill-local → project → framework) and the full framework primitives table, see [FRAMEWORK.md — Op Lookup Order](FRAMEWORK.md#op-lookup-order) and [FRAMEWORK.md — Op Registries](FRAMEWORK.md#op-registries).

**Simple op** — prose for linear behavior:

```markdown
## FETCH_DEFAULTS

Fetch the chart's upstream default values from the internet.
```

**Branching op** — use tree notation internally:

```markdown
## EDIT_TAG << image_defined_in | target_tag

* EDIT_TAG << image_defined_in | target_tag
  * IF << image_defined_in = chart-defaults-only
    * CREATE_ENV_OVERRIDE
  * ELSE — edit tag in-place at the path from image_defined_in
```

---

## Category Resource Directories

Structured content belongs in subdirectories alongside `skill.md`, not inline in the tree. For the full directory table and behaviors, see [FRAMEWORK.md — Category Resource Subdirectories](FRAMEWORK.md#category-resource-subdirectories).

Reference these files at the point of use in the tree, not all at the top:

```
Read `policies/deploy-rules.md` for deployment constraints.
```

One concern per file. Do not bundle unrelated content into a single resource file.

---

## What skill.md Must NOT Contain

`skill.md` is orchestration only. Never put these inline — extract to category subdirs:

- Tables
- JSON or YAML blocks
- Scripts or shell commands
- Inline templates or examples

---

## Testing and Debugging

Use the `debug` meta-skill to trace any skill's execution in real time:

```
/canopy-debug <skill-name> [arguments]
```

No changes to the target skill are required. See [FRAMEWORK.md — Debug Mode](FRAMEWORK.md#debug-mode) for the full reference.
