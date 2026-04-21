#!/usr/bin/env bash

# === Get Latest Release ===
# Output: latest_release_version stripped of leading 'v'; "none" if no release exists
tag=$(gh release list --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null)
if [ -z "$tag" ]; then
  echo "none"
else
  echo "${tag#v}"
fi

# === Check Existing PR ===
# Input: CURRENT_BRANCH env var
# Output: JSON array (number, title, url); empty array if none
gh pr list --head "$CURRENT_BRANCH" --base master --json number,title,url

# === Create PR ===
# Input: CURRENT_BRANCH, CURRENT_VERSION env vars
# Output: PR URL
gh pr create \
  --base master \
  --head "$CURRENT_BRANCH" \
  --title "chore: release v$CURRENT_VERSION" \
  --body "Bump version to v$CURRENT_VERSION. Merging this PR will trigger CI to create the release tag and publish the GitHub Release."
