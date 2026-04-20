# Canopy Cheatsheet

Quick reference. Full spec: [FRAMEWORK.md](FRAMEWORK.md) · Authoring guide: [AUTHORING.md](AUTHORING.md)

---

## Skill anatomy

`frontmatter` → `## Agent` (optional explore subagent) → `## Tree` → `## Rules` → `## Response:`

Use `/canopy scaffold <skill-name>` to generate a blank skill, or see [AUTHORING.md — Skill Anatomy](AUTHORING.md#skill-anatomy) for the full annotated template.

---

## Notation

| Symbol | Meaning |
|--------|---------|
| `<<` | Input — condition, source file, or user options |
| `>>` | Output — captured into context or displayed |
| `\|` | Separator — between options, inputs, or output fields |

---

## Framework primitives

Resolved from `skills/shared/framework/ops.md`. Never redefine in skill or project ops.

| Primitive | Signature | Notes |
|-----------|-----------|-------|
| `IF` | `<< condition` | Execute children if true; chain with `ELSE_IF` / `ELSE` |
| `ELSE_IF` | `<< condition` | Continue chain; evaluated only if all prior branches false |
| `ELSE` | — | Close chain; executed if all prior branches false |
| `SWITCH` | `<< expression` | Evaluate once; execute first matching `CASE`; use instead of long `ELSE_IF` chains on one value |
| `CASE` | `<< value` | Branch within `SWITCH`; fires when expression equals value |
| `DEFAULT` | — | Close `SWITCH`; fires if no `CASE` matched |
| `FOR_EACH` | `<< item in collection` | Execute body once per element; empty collection skips body |
| `BREAK` | — | Inside `FOR_EACH`: exit loop. Outside loop: exit current op |
| `END` | `[message]` | Halt entire skill; display message if provided |
| `ASK` | `<< question \| opt1 \| opt2` | Prompt user; halt until response |
| `SHOW_PLAN` | `>> field1 \| field2` | Present plan before any changes |
| `VERIFY_EXPECTED` | `<< verify/verify-expected.md` | Check state against expected-state checklist |

**Examples:**

```
IF << condition          SWITCH << context.type      FOR_EACH << f in files
├── then-branch          ├── CASE << "create"        ├── validate f
ELSE_IF << other         │   └── CREATE_THING        ├── IF << f has errors
├── branch2              ├── CASE << "delete"        │   └── BREAK
ELSE                     │   └── DELETE_THING        └── write f
└── else-branch          └── DEFAULT
                             └── ASK << ...
```

---

## Op lookup order

1. `<skill>/ops.md` — skill-local
2. `skills/shared/project/ops.md` — project-wide
3. `skills/shared/framework/ops.md` — framework primitives

---

## Defining ops

```markdown
## FETCH_DEFAULTS                          ← simple op: prose

Fetch the chart's upstream default values from the internet.

---

## EDIT_TAG << image_defined_in | target_tag    ← branching op: tree notation

* EDIT_TAG << image_defined_in | target_tag
  * IF << image_defined_in = chart-defaults-only
    * CREATE_ENV_OVERRIDE
  * ELSE
    * edit tag in-place at the path from image_defined_in
```

Op names must be `ALL_CAPS`. Ops may call other ops.

---

## Category resource directories

`schemas/` · `templates/` · `commands/` · `constants/` · `checklists/` · `policies/` · `verify/`

Structured content lives in these subdirectories alongside `skill.md`, never inline in the tree.
Reference at point of use — never front-load: `Read \`policies/deploy-rules.md\` for deployment constraints.`
Full directory reference: [AUTHORING.md — Category Resource Directories](AUTHORING.md#category-resource-directories)

---

## Canopy agent operations

Invoke with `/canopy <request>` or natural language. Every operation shows a plan before making changes.

| Operation | Say… | Effect |
|-----------|------|--------|
| `CREATE` | "create a skill that…" | New skill from scratch |
| `SCAFFOLD` | "scaffold a blank skill called…" | Empty `skill.md` + `ops.md` stubs |
| `MODIFY` | "add X to the Y skill" | Edit existing skill |
| `VALIDATE` | "validate the X skill" | Report errors / warnings / optimizations |
| `IMPROVE` | "improve the X skill" | Apply optimizations and style fixes |
| `CONVERT_TO_CANOPY` | "convert X to Canopy format" | Rewrite prose skill as tree |
| `CONVERT_TO_REGULAR` | "convert X back to plain markdown" | Unwrap tree to prose |
| `REFACTOR_SKILLS` | "refactor all skills" | Deduplicate ops across skills |
| `ADVISE` | "advise on…" | Guidance without changes |
| `HELP` | "help" | List capabilities |

**Debug:** `/canopy-debug <skill> [args]` — live phase banners and per-node tracing. See [FRAMEWORK.md — Debug Mode](FRAMEWORK.md#debug-mode).

---

## skill.md must NOT contain

Tables · JSON/YAML blocks · scripts · inline templates or examples → extract to category subdirectories.

Hardcoded `.claude/` or `.github/` paths → use relative category references only (skills are platform-agnostic).
