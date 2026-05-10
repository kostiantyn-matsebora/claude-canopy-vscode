---
name: update
description: Updates the Canopy subtree to latest, syncs extension implementation and docs, writes and runs unit tests until all pass.
compatibility: Requires the canopy-runtime skill (published at github.com/kostiantyn-matsebora/claude-canopy). Install with any agentskills.io-compatible tool — e.g. `gh skill install`, `git clone`, the repo's `install.sh`/`install.ps1`, or the Claude Code plugin marketplace. Supports Claude Code and GitHub Copilot.
metadata:
  argument-hint: ""
---

> **Runtime required.** This skill uses Canopy tree notation; canopy-runtime must be active.
>
> **Detect canopy-runtime** — present if either:
> - `canopy-runtime/SKILL.md` exists under `.claude/skills/`, `.github/skills/`, or `.agents/skills/`, OR
> - a canopy-runtime marker block exists in `CLAUDE.md` or `.github/copilot-instructions.md`.
>
> **If neither is present** — install canopy-runtime first (see the `compatibility` field for the source and install options), then re-invoke this skill.
>
> Do not interpret the `## Tree` without canopy-runtime active.

---

## Agent

**explore** — Read `.canopy-version` at the repo root and treat its contents as `tracked_version`. Run `git ls-remote --tags https://github.com/kostiantyn-matsebora/claude-canopy 'refs/tags/v*'` and pick the highest `vX.Y.Z` tag as `current_version`. Set `upstream_version_available: true` if `current_version` differs from `tracked_version`, otherwise `false`. Run `git status --porcelain` and set `working_tree_dirty: true` if any tracked files are modified. If `upstream_version_available` is true and `working_tree_dirty` is false: read `.claude/skills/canopy-runtime/references/ops.md` (index) and the per-feature slice files under `.claude/skills/canopy-runtime/references/ops/<slice>.md` for the current primitive list and signatures; read `.claude/skills/canopy/constants/category-dirs.md` for the current category directories; read `src/providers/diagnosticsProvider.ts`, `src/providers/completionProvider.ts`, `src/providers/hoverProvider.ts`, `src/opRegistry.ts`, `src/canopyDocument.ts`, `src/extension.ts`, and `package.json` to understand current extension state; read `constants/sync-points.md` for the change-type → file mapping; compare framework state to extension state and populate `changes_detected`. Independently of the upstream check: run `git status src/` and `git log --oneline src/` since the last `CHANGELOG.md` entry to detect uncommitted or recently committed extension-only changes; set `extension_changes_detected: true` if any exist and populate `extension_changes_summary` with `{file, description}` items. Output contract: `schemas/explore-schema.json`.

---

## Tree

* update
  * EXPLORE >> context
  * IF << context.working_tree_dirty is true AND context.upstream_version_available is true
    * Report: Uncommitted changes detected and a newer Canopy version is available. Commit or stash your changes first, then re-run `/update`.
    * END
  * IF << context.upstream_version_available is true AND context.working_tree_dirty is false
    * Run `commands/update.sh <<context.current_version>>` (Unix) or `commands/update.ps1 -Version <<context.current_version>>` (Windows) to install pinned canopy skills via the upstream install script
    * Run `npm run sync-canopy-version` to propagate `.canopy-version` into `package.json`
  * IF << context.upstream_version_available is false AND context.extension_changes_detected is false
    * Report: Canopy is already at latest version (<<context.tracked_version>>) and no extension changes detected. Nothing to update.
    * END
  * SHOW_PLAN >> tracked_version | current_version | changes_detected | extension_changes_detected | extension_changes_summary | files_to_update
  * ASK << Proceed with implementation updates? | Yes | Adjust plan | No
  * FOR_EACH << change in context.changes_detected
    * APPLY_CHANGE << change
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
- Never invoke the install script without first confirming the working tree is clean
- The install script writes `.canopy-version` itself; do not manually edit `package.json`'s `canopyVersion` — run `npm run sync-canopy-version` instead
- If ASK returns "Adjust plan", re-run SHOW_PLAN with the adjusted scope
- If ASK returns "No", END without making changes

## Response: Summary / Canopy version / Files updated / Tests written / Test results
