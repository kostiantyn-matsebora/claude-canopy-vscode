---
name: canopy-runtime
description: Canopy framework execution engine. Interprets canopy-flavored skills (any SKILL.md with a `## Tree` section) at runtime — platform detection, section semantics (`## Agent`/`## Tree`/`## Rules`/`## Response:`), tree notation (`<<`, `>>`, `|`), control-flow primitives (`IF`/`ELSE_IF`/`ELSE`/`SWITCH`/`CASE`/`DEFAULT`/`FOR_EACH`/`BREAK`/`END`), interaction primitives (`ASK`/`SHOW_PLAN`), execution primitives (`EXPLORE`/`VERIFY_EXPECTED`), op lookup chain, category directory semantics, subagent contract. Install this to execute existing canopy skills. Install `canopy` (the authoring agent) too if you need to create/edit/manage them.
license: MIT
user-invocable: false
metadata:
  version: "0.17.0"
  author: kostiantyn-matsebora
---

# Canopy Runtime

The execution engine for canopy-flavored skills. Any skill whose `SKILL.md` declares a `## Tree` section is canopy-flavored and relies on this spec.

## Platform detection

- `.claude/skills/` present → Claude Code → apply `references/runtime-claude.md`.
- `.github/skills/` present → GitHub Copilot → apply `references/runtime-copilot.md`.

## What the runtime defines

- **Sections** — `## Agent` (optional explore subagent), `## Tree` (sequential execution pipeline), `## Rules` (skill-wide invariants), `## Response:` (output format). See `references/skill-resources.md`.
- **Notation** — `<<` input source/options, `>>` captured output/displayed fields, `|` separator. See `references/skill-resources.md`.
- **Control-flow primitives** — `IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`. See `references/framework-ops.md`.
- **Interaction primitives** — `ASK`, `SHOW_PLAN`. See `references/framework-ops.md`.
- **Execution primitives** — `EXPLORE` (first node when `## Agent` declares `**explore**`), `VERIFY_EXPECTED`. See `references/framework-ops.md`.
- **Op lookup chain** — `<skill>/ops.md` → consumer-defined cross-skill ops → `references/framework-ops.md` for framework primitives. See `references/skill-resources.md`.
- **Category directories** — `schemas/`, `templates/`, `commands/`, `constants/`, `checklists/`, `policies/`, `verify/`, `references/`. Each has defined behavior. See `references/skill-resources.md`.
- **Tree syntax** — markdown-list (`*` nested bullets) and box-drawing (fenced tree characters). Both recognized. See `references/skill-resources.md`.
- **Preamble** — text between frontmatter and `## Tree` parses `$ARGUMENTS`. See `references/skill-resources.md`.
- **Subagent contract** — `## Agent` declaring `**explore**` requires `EXPLORE >> context` as first tree node and schema at `schemas/explore-schema.json`. See `references/skill-resources.md`.
- **Platform-specific execution** — Claude uses native subagents; Copilot falls back to inline sequential reading. See `references/runtime-claude.md` and `references/runtime-copilot.md`.

## Not a user-invocable skill

`canopy-runtime` is hidden from the `/` menu (`user-invocable: false`). It is loaded:
- Ambiently via the `canopy-runtime` marker block that install scripts add to `CLAUDE.md` (Claude Code) or `.github/copilot-instructions.md` (Copilot).
- Explicitly by the `canopy` authoring agent and `canopy-debug` trace skill at the top of their trees.
- On-demand by Claude's skill-description discovery when a canopy-flavored skill is invoked.
