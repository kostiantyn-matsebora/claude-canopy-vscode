# Operation Detection

Identify the operation from the user's request — use the first matching row:

| Operation | Trigger phrases |
|-----------|----------------|
| `CREATE` | "create a skill", "new skill", "write a skill", "build a skill" |
| `MODIFY` | "modify", "update", "change", "add to", "edit" (an existing skill) |
| `SCAFFOLD` | "scaffold", "skeleton", "stub", "template", "blank skill" |
| `CONVERT_TO_CANOPY` | "convert to canopy", "canopy-ify", "migrate to canopy", "make canopy" |
| `VALIDATE` | "validate", "audit", "review", "check", "evaluate" (a skill) |
| `IMPROVE` | "improve", "bring up to date", "align with framework", "apply framework rules" |
| `ADVISE` | "how to", "how should I", "best way to", "advise", "suggest", "what's the right way", "how would you implement" |
| `REFACTOR_SKILLS` | "refactor skills", "deduplicate skills", "extract shared", "extract common ops", "extract common resources", "improve reusability across skills" |
| `CONVERT_TO_REGULAR` | "convert to regular", "de-canopy", "flatten", "convert back", "plain skill" |
| `HELP` | "help", "what can you do", "list operations", "what operations", "how do I use", "usage" |
