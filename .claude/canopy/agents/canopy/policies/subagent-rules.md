# Subagent Contract Rules

If a skill launches a subagent:

- Schema must exist as `schemas/explore-schema.json`.
- `## Agent` section needs only the task description — "do not inline-read" and "return JSON only matching schema" are implicit from the ambient `skill-resources.md`.
- No freeform prose output — every field the skill uses must be declared in the schema.
- First tree node must be `EXPLORE >> context` when `## Agent` declares `**explore**`.
