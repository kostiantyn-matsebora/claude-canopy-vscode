---
name: bump-version
description: Bumps the extension version and adds a changelog entry based on the update skill result or git diff since the last changelog entry. Does not create a git tag — CI creates the tag on push to master.
compatibility:
  requires:
    - canopy-runtime
metadata:
  argument-hint: ""
---

> **Safety preamble** — This skill requires canopy-runtime to interpret its `## Tree`
> section. If the active agent has no canopy-runtime installed (no marker block in
> `CLAUDE.md` / `.github/copilot-instructions.md`, no `canopy-runtime/SKILL.md` under
> `.claude/skills/` or `.github/skills/`), HALT with a message instructing the user
> to install canopy. Do not attempt to interpret the tree without runtime.

---

## Agent

**explore** — Read `package.json` and extract `version` as `current_version`. Read `CHANGELOG.md` and extract the most recent version heading as `last_changelog_version` and its date. Set `version_already_bumped: true` if `current_version` differs from `last_changelog_version` (package.json was bumped but the changelog entry is missing or the git commit was never made). Check whether an `update` skill result is available in conversation context (listed changes, canopy version bump); if so, set `has_update_context: true` and populate `changes_summary` from it. If not, run `git log --oneline` and `git diff` between HEAD and the commit at `last_changelog_version` to derive `changes_summary`. Output contract: `schemas/explore-schema.json`.

---

## Tree

* bump-version
  * EXPLORE >> context
  * IF << context.changes_summary is empty
    * Read `constants/messages.md`
    * Report: no_changes
    * END
  * DETERMINE_BUMP_TYPE << context.changes_summary >> bump_type | new_version
  * SHOW_PLAN >> current_version | new_version | bump_type | changelog_summary | readme_changes
  * ASK << Proceed? | Yes | Adjust | No
  * IF << context.version_already_bumped is false
    * Run `npm version <bump_type> --no-git-tag-version` to update `version` in `package.json`
    * IF << context.has_update_context is true
      * Run `npm run sync-canopy-version` to sync the embedded Canopy framework version
  * IF << CHANGELOG.md does not already contain an entry for `new_version`
    * Prepend new changelog entry to `CHANGELOG.md` following the existing format
  * UPDATE_README << context.changes_summary
  * Run `git add package.json CHANGELOG.md README.md`
  * Run `git commit -m "chore: release v<new_version>"`
  * VERIFY_EXPECTED << verify/bump-expected.md
  * Report: Summary / Old version / New version / Changelog entry

## Rules

- Never skip a version level — patch → minor → major only; no skipping from patch to major
- Always read `package.json` and `CHANGELOG.md` before writing to them
- Changelog entry must use the same `## [X.Y.Z] — YYYY-MM-DD` heading format with today's date
- Changelog entry must group items under `### Added`, `### Changed`, and/or `### Fixed` — only include non-empty groups
- If ASK returns "Adjust", re-show the plan with the adjusted bump type or changelog content
- Never create a local git tag during version bumping — CI creates the tag after the push to master

## Response: Summary / Old version / New version / Changelog entry
