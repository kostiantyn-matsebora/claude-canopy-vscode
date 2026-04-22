# SCAFFOLD — Expected State

After SCAFFOLD completes successfully:

- [ ] `<skill_dir>/skill.md` exists under the target platform's skills base path (resolved via `policies/platform-targeting.md`) with frontmatter, `## Tree`, `## Rules`, and `## Response:` sections
- [ ] `skill.md` contains no hardcoded `.claude/` or `.github/` paths in tree nodes or `Read` references
- [ ] Tree syntax matches the choice made at step 3 (list `*` or box-drawing)
- [ ] `<skill_dir>/ops.md` exists as a placeholder
- [ ] No other files were created or modified
