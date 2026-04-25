# Expected State After Update

- [ ] Canopy skills installed from latest version via install script (`.claude/skills/{canopy,canopy-debug,canopy-runtime}/SKILL.md` exist and reflect the target version)
- [ ] `.canopy-version` at repo root contains the new version string
- [ ] `canopyVersion` in `package.json` matches `.canopy-version` (run via `npm run sync-canopy-version`)
- [ ] All change types detected by EXPLORE have a corresponding APPLY_CHANGE step applied
- [ ] `src/providers/diagnosticsProvider.ts` lists all current framework primitives in `RESERVED_PRIMITIVES`
- [ ] `src/opRegistry.ts` has `PRIMITIVE_DOCS` entries for all current framework primitives
- [ ] `checkPrimitiveSignatures()` in `src/providers/diagnosticsProvider.ts` handles all current primitives
- [ ] `VALID_CATEGORIES` in `src/providers/diagnosticsProvider.ts` matches current category dirs
- [ ] `CATEGORY_DIRS` in `src/providers/completionProvider.ts` matches current category dirs
- [ ] `FRONTMATTER_ALLOWED` / `FRONTMATTER_KEYS` / `FRONTMATTER_DOCS` cover the current agentskills.io frontmatter spec
- [ ] `package.json` language IDs and filename patterns match current category dirs
- [ ] `CHANGELOG.md` updated with canopy version bump and summary of changes
- [ ] Unit tests written for all modified source files
- [ ] `npm test` exits with zero failures
