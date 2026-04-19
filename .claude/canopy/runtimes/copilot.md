# GitHub Copilot Runtime

Defines how Canopy skill constructs execute on the GitHub Copilot platform.

---

## Base Paths

- Skills: `.github/skills/<name>/skill.md`
- Agents: `.github/agents/<name>.md`
- Shared ops: `.github/skills/shared/`
- Rules: `.github/copilot-instructions.md`

## Agent Execution (`## Agent` section)

Native explore subagent is **not supported**. When a skill declares `## Agent`, apply the inline fallback:

- Do NOT launch a subagent
- Read the files described in the `## Agent` task body sequentially at the start of execution, before the first tree node
- Treat all gathered content as `context`, structured to match `schemas/explore-schema.json`
- The first tree node (`EXPLORE >> context`) is satisfied by this inline reading step

## Ambient Rules

Rules do not auto-apply via globs. Options in order of preference:

1. Add rule content to `.github/copilot-instructions.md` — applies globally to all Copilot interactions
2. Reference from `.github/prompts/canopy.prompt.md` — applies when the `/canopy` prompt is invoked

## Invocation

- Agent: no `@canopy` shorthand — use explicit form: `Follow .github/agents/canopy.md and <request>`
- Skills: `/canopy` via `.github/prompts/canopy.prompt.md` if configured; otherwise explicit path

## Op Lookup

1. `.github/skills/<skill>/ops.md` — skill-local
2. `.github/skills/shared/project/ops.md` — project-wide
3. `.github/skills/shared/framework/ops.md` — framework primitives
