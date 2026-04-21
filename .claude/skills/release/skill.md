---
name: release
description: Pushes to master (directly or via PR) to trigger automated tag creation and GitHub Release. Supports both direct-master and feature-branch PR workflows.
argument-hint: ""
---

---

## Tree

* release
  * Read `package.json` to get `current_version`
  * Run `git branch --show-current` to get `current_branch`
  * Run `gh release view --latest --json tagName --jq .tagName` to get `latest_release_tag`; strip leading `v` to get `latest_release_version`. If no release exists, set `latest_release_version` to "none".
  * Run `git status --porcelain` to detect uncommitted changes; set `working_tree_dirty` to true if any output is returned
  * IF << working_tree_dirty is true
    * Report: Uncommitted changes detected. Commit or stash them first, then re-run `/release`.
    * END
  * IF << current_version equals latest_release_version
    * Report: Version `current_version` is already the latest GitHub release. Run `/bump-version` to increment the version, then re-run `/release`.
    * END
  * IF << current_branch equals "master"
    * SHOW_PLAN >> current_version | latest_release_version | action: "push master — CI will create tag and trigger release"
    * ASK << Push master to trigger release? | Yes | No
    * Run `git push origin master`
    * VERIFY_EXPECTED << verify/release-expected.md
    * Report: Summary / Version / Next step: CI creates tag and publishes GitHub Release
  * ELSE
    * Run `gh pr list --head <current_branch> --base master --json number,title,url` to check for an existing PR
    * IF << existing PR found
      * Report: A PR already exists for branch `current_branch`: `<pr_url>`. Push the branch to update it or merge the existing PR.
      * END
    * SHOW_PLAN >> current_version | latest_release_version | current_branch | action: "push branch + open PR to master"
    * ASK << Push branch and open PR to master? | Yes | No
    * Run `git push origin <current_branch>`
    * Run `gh pr create --base master --head <current_branch> --title "chore: release v<current_version>" --body "Bump version to v<current_version>. Merging this PR will trigger CI to create the release tag and publish the GitHub Release."`
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
