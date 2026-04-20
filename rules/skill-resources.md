---
globs: [".claude/skills/**"]
---

# Skill Resource Conventions

This is the **standalone** version of this file — used when Canopy is your entire `.claude/` directory.
When using Canopy as a **git submodule** at `.claude/canopy/`, run `setup.sh` / `setup.ps1` from the submodule
rather than using this file — it creates a correctly wired version at `.claude/rules/skill-resources.md` in your project.

---

## Category behavior

When a skill step says `Read <category>/<file>`, the directory determines behavior:

| Category | File types | Behavior |
|----------|------------|----------|
| `schemas/` | `.json`, `.md` | Structure definitions for data the skill reads or writes: subagent output contracts, input/config file shapes, report template skeletons |
| `templates/` | `.yaml`, `.md`, `.yaml.gotmpl` | Fillable output documents with `<token>` placeholders substituted from context and written to a target path |
| `commands/` | `.ps1`, `.sh` | Executable scripts invoked by name via a named section (`# === Section Name ===`); output captured into context |
| `constants/` | `.md` | Read-only lookup data referenced by ops: mapping tables, enum-like value lists, fixed configuration values, default branch/path names |
| `checklists/` | `.md` | Evaluation criteria lists (`- [ ] ...`) that ops iterate over to assess compliance or correctness |
| `policies/` | `.md` | Behavioural constraints governing skill execution: what the skill must/must not do, consent requirements, output rendering protocols |
| `verify/` | `.md` | Expected-state checklists consumed exclusively by `VERIFY_EXPECTED` |

**Reference line pattern:** `Read \`<category>/<file>\` for <brief description>.`
Load at point of use in the tree — never front-load all reads at the top.

## Named operations

When a step or tree node contains an ALL_CAPS identifier:
1. Look up in `<skill>/ops.md` first (skill-local ops)
2. Fall back to `.claude/skills/shared/project/ops.md` (project-wide ops)
3. Fall back to `.claude/skills/shared/framework/ops.md` (framework primitives)

`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED` are primitives — always in `shared/framework/ops.md`.

## Tree format

When a skill has `## Tree` instead of `## Steps`: execute the tree top-to-bottom as a sequential pipeline.

Two equivalent syntaxes are accepted:

**Markdown list syntax** — `*` nested lists written directly under `## Tree` (no fenced code block):
```markdown
* skill-name
  * OP_NAME << input >> output
  * IF << condition
    * branch-op
  * ELSE
    * other-op
```

**Box-drawing syntax** — fenced code block with tree characters:
```
skill-name
├── OP_NAME << input >> output
├── IF << condition
│   └── branch-op
└── ELSE
    └── other-op
```

Both syntaxes express the same execution model. Use whichever is easier to read and maintain.

Each node is either an op call (`OP_NAME << inputs >> outputs`) or natural language — both are valid.
`IF` nodes branch on condition; both branches may be op calls or natural language.
Op definitions in `<skill>/ops.md`, `shared/project/ops.md`, and `shared/framework/ops.md` may also use tree notation internally.

## Explore subagent

When a skill has a `## Agent` section declaring `**explore**`:
- Launch an Explore subagent with the task described in that section
- Do NOT inline-read files yourself
- Use `schemas/explore-schema.json` as the output contract; return JSON only
