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
3. `shared/framework/ops.md` — framework primitives (`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`)

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
- `agents/canopy.md` — bundled agent (Canopy skill format): detects platform, loads runtime, dispatches deterministically to one of 10 ops via `IF/ELSE_IF` tree
- `agents/canopy/ops/` — per-operation procedure files (one per operation)
- `agents/canopy/constants/` — lookup tables: category dirs, control flow notation, operation detection, dispatch map
- `agents/canopy/policies/` — rule files: `authoring-rules.md` (skill structure, writing style, op naming, subagent contract, debug meta-skill), `category-decision-flowchart.md`, `platform-targeting.md`, `preservation-rules.md`, `conversion-expansion-rules.md`
- `agents/canopy/schemas/explore-schema.json` — output contract for skill-analysis explore subagents (used by ops)
- `agents/canopy/schemas/dispatch-schema.json` — output contract for the canopy agent's own intent-classification subagent
- `agents/canopy/verify/` — expected-state checklists for `VERIFY_EXPECTED` per operation
- `agents/canopy/templates/` — `skill.md` and `ops.md` skeletons used by SCAFFOLD
- `runtimes/claude.md` — Claude Code runtime spec (base paths, subagent execution, ambient rules, invocation)
- `runtimes/copilot.md` — GitHub Copilot runtime spec (base paths, inline subagent fallback, invocation)

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

Every framework change must also be verified against documentation. After any change, check that `runtimes/claude.md`, `runtimes/copilot.md`, and `AUTHORING.md` still accurately describe the current behavior — invocation instructions, subagent execution, base paths, and any other runtime-specific details. Update any stale content before the work is considered done.

Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`).

## Versioning

When bumping the framework version, update **both**:
1. `.canopy-version` — single line containing the new version string (e.g. `0.13.0`)
2. `docs/CHANGELOG.md` — prepend a new `## [X.Y.Z] — YYYY-MM-DD` entry

Both files must be kept in sync. `.canopy-version` is the machine-readable source of truth consumed by consumer repos (e.g. via `git ls-remote` + subtree workflows).

## skill.md Constraints

`skill.md` must contain **only** orchestration — no tables, JSON/YAML blocks, scripts, inline examples, or templates. Structured content belongs in category subdirectories. See `agents/canopy/policies/authoring-rules.md` for the full rule set.

## Platform Compatibility

Canopy must remain fully compatible with **both** Claude Code and **GitHub Copilot**.

- Every change to skills, ops, agents, rules, or setup scripts must be verified against both platforms before the work is considered done.
- If a construct works on one platform but not the other, it must be reworked until it passes on both, or the incompatibility must be explicitly documented with a rationale.
