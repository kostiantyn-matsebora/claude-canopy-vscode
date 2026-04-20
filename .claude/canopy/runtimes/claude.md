# Claude Code Runtime

Defines how Canopy skill constructs execute on the Claude Code platform.

---

## Base Paths

- Skills: `.claude/skills/<name>/skill.md`
- Agents: `.claude/agents/<name>.md`
- Shared ops: `.claude/skills/shared/`
- Rules: `.claude/rules/`

## Agent Execution (`## Agent` section)

Native explore subagent is supported. When a skill declares `## Agent`:

- Launch an Explore subagent with the task described in the `## Agent` body
- Do NOT inline-read files yourself — the subagent handles all file access
- Output contract is defined in `schemas/explore-schema.json`
- First tree node must be `EXPLORE >> context`

## Ambient Rules

Rules in `.claude/rules/*.md` with a `globs` frontmatter field auto-apply to all matching files. No additional wiring needed — Claude Code resolves them automatically.

## Invocation

- Agent: `/canopy <request>` — delegates to `.claude/agents/canopy.md` via the bundled `canopy` skill
- Skills: `/skill-name` — resolved from `.claude/skills/<name>/skill.md`

## Op Lookup

1. `.claude/skills/<skill>/ops.md` — skill-local
2. `.claude/skills/shared/project/ops.md` — project-wide
3. `.claude/skills/shared/framework/ops.md` — framework primitives
