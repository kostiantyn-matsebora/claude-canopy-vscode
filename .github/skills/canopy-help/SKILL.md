---
name: canopy-help
description: "Show help for the Canopy skill framework and the canopy agent: what Canopy is, how to invoke the agent, and what operations are available. Use when: learning about Canopy; browsing available operations; getting started with skill authoring."
argument-hint: "[operation]"
---

Parse `$ARGUMENTS`: if an operation name is given (e.g. `CREATE`, `IMPROVE`, `convert-to-canopy`), normalise it to lowercase kebab-case and bind to `op_file`; otherwise leave `op_file` empty.

Operation → file mapping (case-insensitive, `_` and `-` interchangeable):

| Argument | File |
|----------|------|
| `CREATE` | `create.md` |
| `MODIFY` | `modify.md` |
| `SCAFFOLD` | `scaffold.md` |
| `CONVERT_TO_CANOPY` / `convert-to-canopy` | `convert-to-canopy.md` |
| `VALIDATE` | `validate.md` |
| `CONVERT_TO_REGULAR` / `convert-to-regular` | `convert-to-regular.md` |
| `REFACTOR_SKILLS` / `refactor-skills` | `refactor-skills.md` |
| `ADVISE` | `advise.md` |
| `IMPROVE` | `improve.md` |
| `HELP` | `help.md` |

---

## Tree

* canopy-help
  * IF << .claude/skills/canopy-agent/SKILL.md exists
    * Set `agent_base` = `.claude/skills/canopy-agent/ops`
  * ELSE
    * Set `agent_base` = `.github/skills/canopy-agent/ops`
  * IF << op_file is empty
    * Read `<agent_base>/help.md` and emit its content verbatim
  * ELSE_IF << op_file is a recognised operation file
    * Read `<agent_base>/<op_file>` and emit its content verbatim
  * ELSE
    * Emit: `Unknown operation "$ARGUMENTS". Run without arguments for the full operations list.`

## Rules

- Read-only — no files are written.
- Emit the file content exactly as authored; do not summarise or paraphrase.
- If the argument does not match any known operation, emit the error message from the ELSE branch and stop.

## Response: Canopy help reference / Operation procedure
