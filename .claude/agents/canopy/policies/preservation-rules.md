# Preservation Rules

When modifying an existing Canopy skill:

- Preserve the existing tree syntax — do not switch `*` (Markdown list) ↔ box-drawing characters unless explicitly asked.
- Do not change skill logic or intent — only structure and resource placement may change.
- Do not remove or reposition existing tree nodes unless the change was explicitly requested.
- Do not merge ops that share a name but have meaningfully different behaviour — flag those as conflicts instead.
- Do not alter `## Rules` or `## Response:` wording unless explicitly requested.
