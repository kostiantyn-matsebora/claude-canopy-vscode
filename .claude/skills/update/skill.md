---
name: update
description: Updates the Canopy subtree to latest, syncs extension implementation and docs, writes and runs unit tests until all pass.
argument-hint: ""
---

---

## Agent

**explore** — Read `package.json` and extract `canopyVersion` as `tracked_version`. Run `git log --oneline .claude/canopy/ | head -1` to get the current subtree head SHA. Run `git ls-remote https://github.com/kostiantyn-matsebora/claude-canopy master` to get the upstream SHA. Set `upstream_version_available: true` if the upstream SHA differs from the current subtree head, otherwise `false`. Derive `current_version` from the upstream SHA (short form). Run `git status --porcelain` and set `working_tree_dirty: true` if any tracked files are modified, otherwise `false`. If `upstream_version_available` is true and `working_tree_dirty` is false: read `.claude/canopy/skills/shared/framework/ops.md` to get the current primitive list and signatures; read `src/providers/diagnosticsProvider.ts`, `src/providers/completionProvider.ts`, `src/opRegistry.ts`, `src/canopyDocument.ts`, and `package.json` to understand current extension state; read `constants/sync-points.md` for the full sync-point mapping table; compare framework state to extension state and populate `changes_detected`. Independently of the upstream check: run `git status src/` and `git log --oneline src/` since the last `CHANGELOG.md` entry to detect uncommitted or recently committed extension-only changes; set `extension_changes_detected: true` if any exist and populate `extension_changes_summary` with `{file, description}` items. Output contract: `schemas/explore-schema.json`.

---

## Tree

* update
  * EXPLORE >> context
  * IF << context.working_tree_dirty is true AND context.upstream_version_available is true
    * Report: Uncommitted changes detected and a newer Canopy version is available. Commit or stash your changes first, then re-run `/update`.
    * END
  * IF << context.upstream_version_available is true AND context.working_tree_dirty is false
    * Pull canopy subtree to latest version using `commands/update.sh` (Unix) or `commands/update.ps1` (Windows)
  * IF << context.upstream_version_available is false AND context.extension_changes_detected is false
    * Report: Canopy subtree is already at latest version (<<context.tracked_version>>) and no extension changes detected. Nothing to update.
    * END
  * SHOW_PLAN >> tracked_version | current_version | changes_detected | extension_changes_detected | extension_changes_summary | files_to_update
  * ASK << Proceed with implementation updates? | Yes | Adjust plan | No
  * FOR_EACH << change in context.changes_detected
    * APPLY_CHANGE << change
  * Update `canopyVersion` in `package.json` to `context.current_version`
  * IF << CHANGELOG.md does not already contain an entry for `context.current_version`
    * Update `CHANGELOG.md` to document the canopy version bump and all applied changes
  * WRITE_UNIT_TESTS >> tests_written
  * RUN_TESTS_UNTIL_PASS
  * VERIFY_EXPECTED << verify/update-expected.md
  * Report: Summary / Canopy version / Files updated / Tests written / Test results

## Rules

- Never overwrite extension source files without reading them first
- Apply changes incrementally — one change type at a time via APPLY_CHANGE
- Do not modify test files during APPLY_CHANGE; test writing is handled by WRITE_UNIT_TESTS
- Never pull the subtree without first confirming the working tree is clean
- If ASK returns "Adjust plan", re-run SHOW_PLAN with the adjusted scope
- If ASK returns "No", END without making changes

## Response: Summary / Canopy version / Files updated / Tests written / Test results
