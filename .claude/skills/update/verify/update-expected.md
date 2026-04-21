# Expected State After Update

- [ ] Canopy subtree pulled to latest commit (git log shows new squash merge for `.claude/canopy/`)
- [ ] `canopyVersion` in `package.json` updated to match current canopy version
- [ ] All change types detected by EXPLORE have a corresponding APPLY_CHANGE step applied
- [ ] `src/providers/diagnosticsProvider.ts` lists all current framework primitives in `RESERVED_PRIMITIVES`
- [ ] `src/opRegistry.ts` has `PRIMITIVE_DOCS` entries for all current framework primitives
- [ ] `checkPrimitiveSignatures()` in `src/providers/diagnosticsProvider.ts` handles all current primitives
- [ ] `VALID_CATEGORIES` in `src/providers/diagnosticsProvider.ts` matches current category dirs
- [ ] `CATEGORY_DIRS` in `src/providers/completionProvider.ts` matches current category dirs
- [ ] `package.json` language IDs and filename patterns match current category dirs
- [ ] `docs/CHANGELOG.md` updated with canopy version bump and summary of changes
- [ ] Unit tests written for all modified source files
- [ ] `npm test` exits with zero failures
