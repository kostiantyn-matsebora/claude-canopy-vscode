# CONVERT_TO_REGULAR — Expected State

After CONVERT_TO_REGULAR completes successfully:

- [ ] Output file exists (either `SKILL.md` overwritten or `skill-regular.md` written alongside)
- [ ] Output file contains `## Steps` (numbered list), not `## Tree`
- [ ] All `IF`/`ELSE_IF`/`ELSE` nodes expanded to conditional prose
- [ ] All `ASK` and `SHOW_PLAN` nodes expanded to prose equivalents
- [ ] All named op calls replaced with their inlined definitions
- [ ] All `Read \`<category>/<file>\`` references replaced with inlined content
- [ ] If "Replace" was chosen: `ops.md` and all category subdir files deleted
