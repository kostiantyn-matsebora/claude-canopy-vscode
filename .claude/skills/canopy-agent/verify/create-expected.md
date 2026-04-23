# CREATE — Expected State

After CREATE completes successfully:

- [ ] `SKILL.md` exists at `<skill_dir>/SKILL.md` under the target platform's skills base path (resolved via `policies/platform-targeting.md`)
- [ ] `SKILL.md` contains no hardcoded `.claude/` or `.github/` paths in tree nodes or `Read` references
- [ ] `SKILL.md` contains `## Tree`, `## Rules`, and `## Response:` sections
- [ ] `SKILL.md` contains no inline JSON, YAML, tables, scripts, or code blocks
- [ ] `ops.md` exists if any ops were defined that are not covered by shared
- [ ] Each category subdir file exists if content was extracted that is not already in shared
- [ ] VALIDATE reports no Errors on the new skill
