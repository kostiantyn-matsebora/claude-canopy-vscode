# Subagent Contract Rules

If a skill launches a subagent:

- Schema must exist as `schemas/explore-schema.json`.
- `## Agent` section needs only the task description — "do not inline-read" and "return JSON only matching schema" are implicit from the ambient `skill-resources.md`.
- No freeform prose output — every field the skill uses must be declared in the schema.
- First tree node must be `EXPLORE >> context` when `## Agent` declares `**explore**`.

## Platform Fallback (Copilot)

GitHub Copilot does not support native explore subagents. When `context.platform == "copilot"`:

- Do NOT launch a subagent.
- Read the files described in the `## Agent` task body sequentially at the start of the tree, before the first tree node, using inline file reads.
- Treat all gathered content as `context`, structured to match `schemas/explore-schema.json`.
- The `EXPLORE >> context` node is satisfied by this inline reading step — no subagent is launched.
