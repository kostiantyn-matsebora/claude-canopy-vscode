# Op Naming Rules

## Named operations for recognizable patterns

Replace multi-line blocks expressing a single recognizable operation with a named op.

Lookup order: `<skill>/ops.md` first, then `shared/project/ops.md`, then `shared/framework/ops.md`.

- Cross-skill project ops → `shared/project/ops.md`
- Framework primitives → `shared/framework/ops.md`
- Skill-local ops → `<skill>/ops.md`

Named op notation: `OP_NAME << inputs >> outputs`

## Skill-local ops.md for branches and procedures

Conditional branches, multi-step procedures, and decision trees specific to one skill belong in `<skill>/ops.md`.

Op definitions use tree notation where branching exists; prose for simple linear ops.
