<!-- canopy-runtime-begin -->
## Canopy Runtime

Any `SKILL.md` under `.claude/skills/` or `.github/skills/` that declares a `## Tree`
section is a canopy-flavored skill. Before interpreting it, load
`<skills-root>/canopy-runtime/SKILL.md` and apply the execution model defined
there — sections (`## Agent`, `## Tree`, `## Rules`, `## Response:`), tree
notation (`<<`, `>>`, `|`), control-flow and interaction primitives, op lookup
chain (skill-local ops.md → consumer project ops → framework primitives),
category directory semantics (`schemas/`/`templates/`/`commands/`/`constants/`/
`checklists/`/`policies/`/`verify/`/`references/`), subagent contract
(`EXPLORE` as first node when `## Agent` declares `**explore**`), and the
active platform runtime (`references/runtime-claude.md` or
`references/runtime-copilot.md`).

`<skills-root>` resolves to `.claude/skills/` on Claude Code and `.github/skills/`
on Copilot.
<!-- canopy-runtime-end -->
