# REFACTOR_SKILLS — Expected State

After REFACTOR_SKILLS completes successfully:

- [ ] Each extracted op appears exactly once in the target shared `ops.md` (appended, not duplicated)
- [ ] Each extracted resource file exists at `shared/project/<category>/<filename>`
- [ ] Source skills no longer contain the extracted op definitions in their `ops.md`
- [ ] Source skills whose `ops.md` became empty have had the file deleted
- [ ] All `skill.md` and `ops.md` references in source skills point to the new shared path
- [ ] No tree structure, logic, or intent changed in any source skill
- [ ] VALIDATE reports no Errors on any modified skill
