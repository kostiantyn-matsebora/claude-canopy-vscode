---
name: release
description: Pushes to master (directly or via PR) to trigger automated tag creation and GitHub Release. Supports both direct-master and feature-branch PR workflows.
compatibility: Requires the canopy-runtime skill (published at github.com/kostiantyn-matsebora/claude-canopy). Install with any agentskills.io-compatible tool — e.g. `gh skill install`, `git clone`, the repo's `install.sh`/`install.ps1`, or the Claude Code plugin marketplace. Supports Claude Code and GitHub Copilot.
metadata:
  argument-hint: ""
---

> **Runtime required:** This skill uses Canopy tree notation and depends on the
> canopy-runtime skill. If canopy-runtime is not installed in the active
> workspace (no `canopy-runtime/SKILL.md` under `.claude/skills/`,
> `.github/skills/`, or `.agents/skills/`, and no canopy-runtime marker block
> in `CLAUDE.md` or `.github/copilot-instructions.md`), install it first using
> any tool available to you (see this skill's `compatibility` field for the
> source). Do not interpret the tree without canopy-runtime active.

## Tree

* release
  * Read `package.json` to get `current_version`
  * Run `git branch --show-current` to get `current_branch`
  * Read `commands/release.sh` for `Get Latest Release` >> latest_release_version
  * Run `git status --porcelain` >> status_output
  * IF << status_output is non-empty
    * Report: Uncommitted changes detected. Commit or stash them first, then re-run `/release`.
    * END
  * IF << current_version equals latest_release_version
    * Report: Version `current_version` is already the latest GitHub release. Run `/bump-version` to increment the version, then re-run `/release`.
    * END
  * IF << current_branch equals "master"
    * SHOW_PLAN >> current_version | latest_release_version | action
    * ASK << Push master to trigger release? | Yes | No
    * Run `git push origin master`
    * VERIFY_EXPECTED << verify/release-expected.md
    * Report: Summary / Version / Next step: CI creates tag and publishes GitHub Release
  * ELSE
    * Read `commands/release.sh` for `Check Existing PR` >> existing_pr
    * IF << existing_pr found
      * Report: A PR already exists for branch `current_branch`: `<pr_url>`. Push the branch to update it or merge the existing PR.
      * END
    * SHOW_PLAN >> current_version | latest_release_version | current_branch | action
    * ASK << Push branch and open PR to master? | Yes | No
    * Run `git push origin <current_branch>`
    * Read `commands/release.sh` for `Create PR` >> pr_url
    * VERIFY_EXPECTED << verify/release-expected.md
    * Report: Summary / Version / PR URL / Next step: merge the PR to trigger the release

## Rules

- Always read `package.json` before comparing versions — never assume the current version from context
- Always run `gh release view` to get the live GitHub release — never assume the latest release version
- Do not push or create PR if ASK returns "No"
- Do not create a PR if one already exists for the current branch targeting master
- Do not use `--follow-tags` in either path — no local tag exists; CI creates the tag on push to master
- Always check for uncommitted changes before pushing — a dirty working tree means work would be excluded from the release

## Response: Summary / Version / Next step
