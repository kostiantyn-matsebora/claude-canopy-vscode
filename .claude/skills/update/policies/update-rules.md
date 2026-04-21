# Update Rules

## Safety

- Always read a file before writing to it — never overwrite blindly
- Apply one change type at a time; do not batch multiple change types into a single edit
- If a sync-point mapping does not match the current code structure (e.g. a constant was renamed), stop and report the discrepancy before proceeding

## Scope

- Only modify files listed in `constants/sync-points.md` for the detected change type
- Do not refactor unrelated code while applying a framework change
- Do not update `docs/CHANGELOG.md` until all APPLY_CHANGE steps are complete and confirmed

## Tests

- Write tests only after all APPLY_CHANGE steps are complete
- Match existing test file naming and structure conventions found in `src/test/`
- Do not delete existing passing tests — only add or update

## Subtree

- Always pull the canopy subtree before running the explore subagent
- Do not modify files under `.claude/canopy/` — it is a read-only embedded framework
