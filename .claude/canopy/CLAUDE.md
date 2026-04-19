# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Layout

This workspace contains two repositories managed as a VS Code multi-root workspace (`canopy.code-workspace`):

- **`claude-canopy/`** — the Canopy framework itself (rules, skills, setup scripts, docs)
- **`claude-canopy-examples/`** — an example project that uses Canopy as a git submodule at `.claude/canopy/`

## What Canopy Is

Canopy is a declarative framework for writing Claude Code skills as **syntax trees of named operations**. Skills are `skill.md` files with four sections:

1. **Frontmatter** — `name`, `description`, `argument-hint`
2. **`## Agent`** (optional) — declares an `**explore**` subagent; output contract is always `schemas/explore-schema.json`
3. **`## Tree`** — sequential execution pipeline with `IF`/`ELSE_IF`/`ELSE` branching (two equivalent syntaxes: markdown list `*` or box-drawing fenced block)
4. **`## Rules`** — skill-wide invariants
5. **`## Response:`** — output format declaration

## Op Lookup Order

When a tree node has an `ALL_CAPS` identifier, look up in this order:
1. `<skill>/ops.md` — skill-local
2. `shared/project/ops.md` — project-wide
3. `shared/framework/ops.md` — framework primitives (`IF`, `ELSE_IF`, `ELSE`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`)

Primitives are never overridden.

## Tree Notation

`<<` = input, `>>` = output/displayed fields, `|` = separator between options or fields.

```
skill-name
├── OP_NAME << input >> output
├── ASK << Proceed? | Yes | No
├── IF << condition
│   └── branch-op or natural language
└── ELSE
    └── other action
```

## Category Resource Directories

Each skill directory may contain subdirectories; behavior is determined by directory name:

| Directory | Behavior |
|-----------|----------|
| `schemas/` | Structure definitions: subagent output contracts, input/config file shapes, report template skeletons |
| `templates/` | Fillable output documents with `<token>` placeholders — substituted from context, written to target path |
| `commands/` | `.ps1`/`.sh` scripts with `# === Section Name ===` headers — execute named section, capture output |
| `constants/` | Read-only lookup data: mapping tables, enum-like value lists, fixed configuration values |
| `checklists/` | Evaluation criteria lists (`- [ ] ...`) — iterated by ops to assess compliance or correctness |
| `policies/` | Behavioural constraints: what the skill must/must not do, consent requirements, output protocols |
| `verify/` | Expected-state checklists consumed exclusively by `VERIFY_EXPECTED` |

Reference pattern in skill.md: `Read \`<category>/<file>\` for <brief description>.` — load at point of use, not front-loaded.

## Key Files in `claude-canopy/`

- `FRAMEWORK.md` — canonical framework specification (single source of truth)
- `AUTHORING.md` — manual skill authoring reference (anatomy, tree syntax, ops, category resources)
- `rules/skill-resources.md` — ambient rules auto-applied to all skill files via `globs`
- `skills/shared/framework/ops.md` — immutable framework primitives
- `skills/shared/project/ops.md` — stub for project-wide ops (replace in consuming projects)
- `agents/canopy.md` — bundled agent: CREATE, MODIFY, SCAFFOLD, CONVERT_TO_CANOPY, VALIDATE, CONVERT_TO_REGULAR, IMPROVE, ADVISE, REFACTOR_SKILLS, HELP
- `agents/canopy/ops/` — per-operation procedure files (one per operation)
- `agents/canopy/constants/` — lookup tables: category dirs, control flow notation, operation detection, dispatch map
- `agents/canopy/policies/` — decomposed rule files (skill-structure, writing, op-naming, subagent, debug, preservation, category decision)
- `agents/canopy/verify/` — expected-state checklists for `VERIFY_EXPECTED` per operation
- `agents/canopy/templates/` — `skill.md` and `ops.md` skeletons used by SCAFFOLD

## Setup

Canopy supports three distribution methods (submodule, subtree, installer). In all cases, once Canopy is at `.claude/canopy/`, run:

```bash
bash .claude/canopy/setup.sh   # Linux/macOS
pwsh .claude/canopy/setup.ps1  # Windows
```

Setup is idempotent. It creates:
- `.claude/rules/skill-resources.md` — wired globs covering both project and canopy skills
- `.claude/skills/shared/project/ops.md` — project-wide ops stub
- `.claude/skills/shared/ops.md` — redirect stub
- Symlinks in `.claude/skills/` for each bundled canopy skill (VS Code doesn't scan submodules)
- Symlinks/junctions in `.claude/agents/` for each bundled agent `.md` and its resource directory

## Contributing Rules

When modifying any of these, keep all in sync:
- `FRAMEWORK.md`
- `rules/skill-resources.md`
- `skills/shared/framework/ops.md`
- `agents/canopy/policies/` — update the relevant policy file(s)

Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`).

## skill.md Constraints

`skill.md` must contain **only** orchestration — no tables, JSON/YAML blocks, scripts, inline examples, or templates. Structured content belongs in category subdirectories. See `agents/canopy/policies/skill-structure-rules.md` and `agents/canopy/policies/writing-rules.md` for the full rule set.
