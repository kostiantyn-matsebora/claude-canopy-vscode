# === Get Latest Release ===
# Output: latest_release_version stripped of leading 'v'; "none" if no release exists
$tag = gh release view --latest --json tagName --jq .tagName 2>$null
if (-not $tag) {
    "none"
} else {
    $tag -replace '^v', ''
}

# === Check Existing PR ===
# Input: $env:CURRENT_BRANCH
# Output: JSON array (number, title, url); empty array if none
gh pr list --head $env:CURRENT_BRANCH --base master --json number,title,url

# === Create PR ===
# Input: $env:CURRENT_BRANCH, $env:CURRENT_VERSION
# Output: PR URL
gh pr create `
    --base master `
    --head $env:CURRENT_BRANCH `
    --title "chore: release v$($env:CURRENT_VERSION)" `
    --body "Bump version to v$($env:CURRENT_VERSION). Merging this PR will trigger CI to create the release tag and publish the GitHub Release."
