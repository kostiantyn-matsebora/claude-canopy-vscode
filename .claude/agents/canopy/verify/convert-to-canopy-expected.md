# CONVERT_TO_CANOPY — Expected State

After CONVERT_TO_CANOPY completes successfully:

- [ ] `SKILL.classic.md` exists alongside the new `SKILL.md` (original preserved)
- [ ] `SKILL.md` contains `## Tree`, `## Rules`, and `## Response:` sections
- [ ] `SKILL.md` contains no inline JSON, YAML, tables, scripts, or code blocks
- [ ] Every content block from the original has been placed in the correct category dir per `policies/category-decision-flowchart.md`
- [ ] `ops.md` exists if any ops were defined that are not covered by shared
- [ ] Each new category file contains only content appropriate to its directory
- [ ] Shared references introduced where equivalent content already existed in shared
- [ ] VALIDATE reports no Errors on the converted skill
