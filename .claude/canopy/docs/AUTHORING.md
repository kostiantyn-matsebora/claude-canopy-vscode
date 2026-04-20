# Authoring Skills Manually

This document covers writing Canopy skills by hand. For the recommended approach — letting
the `canopy` agent generate, scaffold, or convert skills for you — see the
[Usage section](README.md#usage) in the README.

For a quick one-page reference covering primitives, op syntax, category directories, and canopy agent operations, see [CHEATSHEET.md](CHEATSHEET.md).

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

Declares an `**explore**` subagent. Keep to a single task description — the rules file
handles the schema contract and no-inline-read behavior implicitly.

```markdown
## Agent

**explore** — reads the files for `<service-name>` under `services/`,
including configs, templates, and existing deployment manifests.
```

The subagent uses `schemas/explore-schema.json` as its output contract automatically.
The first tree node must be `EXPLORE >> context` when `## Agent` is present.

### `## Tree`

The skill's execution pipeline as a syntax tree. Nodes execute top-to-bottom. Each node
is either an **op call** (`ALL_CAPS`) or **natural language** — both are valid.

Two equivalent syntaxes are accepted:

**Markdown list syntax** — `*` nested lists, written directly under `## Tree`:

```markdown
## Tree

* skill-name
  * EXPLORE >> context
  * IF << condition
    * SOME_OP << input
  * ELSE
    * natural language description of what to do
  * SHARED_OP << arg1 | arg2 >> output
  * IF << something went wrong
    * ROLLBACK
```

**Box-drawing syntax** — fenced code block with tree characters:

```markdown
## Tree

\`\`\`
skill-name
├── EXPLORE >> context
├── IF << condition
│   └── SOME_OP << input
├── ELSE
│   └── natural language description of what to do
├── SHARED_OP << arg1 | arg2 >> output
└── IF << something went wrong
    └── ROLLBACK
\`\`\`
```

### `## Rules`

Short bullet list of invariants that apply throughout the skill execution. Do not duplicate
op-level behavior here — these are skill-wide constraints.

### Notation

| Symbol | Meaning |
|--------|---------|
| `<<` | Input — source file, condition to evaluate, or user-facing options |
| `>>` | Output — fields captured into step context, or displayed to user |
| `\|` | Separator — between options or output fields |

---

## Minimal Example

Markdown list syntax:

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

Same skill using box-drawing syntax:

```markdown
## Tree

\`\`\`
my-skill
├── SHOW_PLAN >> what will change
├── ASK << Proceed? | Yes | No
└── do the thing
\`\`\`
```

---

## Defining Ops

Ops are named, reusable steps defined in Markdown files. Lookup order:

1. `<skill>/ops.md` — skill-local (checked first)
2. `shared/project/ops.md` — project-wide
3. `shared/framework/ops.md` — framework primitives (fallback)

**Simple op** — prose for linear behavior:

```markdown
## FETCH_DEFAULTS

Fetch the chart's upstream default values from the internet.
```

**Branching op** — use tree notation internally:

```markdown
## EDIT_TAG << image_defined_in | target_tag

\`\`\`
EDIT_TAG << image_defined_in | target_tag
├── IF << image_defined_in = chart-defaults-only
│   └── CREATE_ENV_OVERRIDE
└── ELSE — edit tag in-place at the path from image_defined_in
\`\`\`
```

### Framework Primitives

Always resolved from `shared/framework/ops.md`. Never define these in skill or project ops:

| Primitive | Signature | Purpose |
|-----------|-----------|---------|
| `IF` | `<< condition` | Branch — execute children if true |
| `ELSE_IF` | `<< condition` | Continue IF chain |
| `ELSE` | — | Close IF chain |
| `SWITCH` | `<< expression` | Match expression against CASE values |
| `CASE` | `<< value` | Branch within SWITCH; execute if expression equals value |
| `DEFAULT` | — | Close SWITCH block; execute if no CASE matched |
| `FOR_EACH` | `<< item in collection` | Iterate body over every element in collection |
| `BREAK` | — | Exit current loop or op; return to caller's next node |
| `END` | `[message]` | Halt skill execution immediately |
| `ASK` | `<< question \| opt1 \| opt2` | Prompt user; halt until response |
| `SHOW_PLAN` | `>> field1 \| field2` | Present pre-execution plan |
| `VERIFY_EXPECTED` | `<< verify/verify-expected.md` | Check state against expected outcomes |

---

## Category Resource Directories

Structured content belongs in subdirectories alongside `skill.md`, not inline in the tree.

| Directory | File types | Behavior |
|-----------|------------|---------|
| `schemas/` | `.json`, `.md` | Structure definitions for data the skill reads or writes: subagent output contracts, input/config file shapes, report template skeletons |
| `templates/` | `.yaml`, `.md`, `.yaml.gotmpl` | Fillable output documents with `<token>` placeholders substituted from context and written to a target path |
| `commands/` | `.ps1`, `.sh` | Executable scripts invoked by name via a named section (`# === Section Name ===`); output captured into context |
| `constants/` | `.md` | Read-only lookup data referenced by ops: mapping tables, enum-like value lists, fixed configuration values, default branch/path names |
| `checklists/` | `.md` | Evaluation criteria lists (`- [ ] ...`) that ops iterate over to assess compliance or correctness |
| `policies/` | `.md` | Behavioural constraints governing skill execution: what the skill must/must not do, consent requirements, output rendering protocols |
| `verify/` | `.md` | Expected-state checklists consumed exclusively by `VERIFY_EXPECTED` |

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

This emits a phase banner at the start of each phase and a full tree-state block before
and after every node, so you can see exactly where execution is at any moment. No
changes to the target skill are required.

Example — tracing `bump-version`:

```
/canopy-debug bump-version 2.1.0
```

You will see:
- `╔══ Phase 1 of 4: Initialize ═══...` banner
- Tree blocks with `→` advancing through each node as it executes, then `✓` on completion
- `⊘` on branches that were not taken, `⏸` while waiting for your input on `ASK` nodes

See [`FRAMEWORK.md` — Debug Mode](FRAMEWORK.md#debug-mode) for the full reference.

---

## Full Specification

See [`FRAMEWORK.md`](FRAMEWORK.md) for the complete framework specification, including
tree execution model, op registry details, and the submodule directory layout.
