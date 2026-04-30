<#
.SYNOPSIS
Tag and release the current canopy-skills version with a SIGNED tag.

.DESCRIPTION
Reads the version from package.json, validates the working tree, creates a
signed git tag (vX.Y.Z) on HEAD, and pushes it. The push triggers
`.github/workflows/release.yml` on GitHub Actions, which:

  - packages the .vsix
  - attests SLSA build provenance via actions/attest-build-provenance
  - creates the GitHub Release with the .vsix attached
  - publishes to the VS Code Marketplace via VSCE_PAT

Replaces the previous `tag-on-merge.yml` auto-tagger so the tag is signed
under the maintainer's key (via the Bitwarden SSH agent), not GitHub's
unsigned bot identity. Local `git config tag.gpgsign` is irrelevant —
this script invokes `git tag -s` explicitly.

.PARAMETER DryRun
Print what would happen, but don't tag or push.

.PARAMETER Force
Skip the interactive y/N confirmation.

.EXAMPLE
.\scripts\release.ps1
Tags v$(node -p require('./package.json').version) on HEAD after a
y/N confirmation.

.EXAMPLE
.\scripts\release.ps1 -DryRun
Prints the planned tag/push without acting.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Repo root = parent of scripts/
$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repo

# Read version from package.json
$version = node -p 'require("./package.json").version'
if ([string]::IsNullOrWhiteSpace($version)) {
    throw 'Could not read .version from package.json.'
}
$tag = "v$version"

Write-Host ("Repo:    {0}" -f $repo)
Write-Host ("Version: {0}" -f $version)
Write-Host ("Tag:     {0}" -f $tag)

# Branch must be master
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'master') {
    throw "Not on master (current: $branch). Releases happen from master."
}

# Working tree must be clean
$status = git status --porcelain
if ($status) {
    throw "Working tree is dirty. Commit or stash first.`n$status"
}

# Up-to-date with origin/master
git fetch origin --tags --quiet
$ahead  = (git rev-list 'origin/master..HEAD' | Measure-Object).Count
$behind = (git rev-list 'HEAD..origin/master' | Measure-Object).Count
if ($ahead -ne 0 -or $behind -ne 0) {
    throw "Local master is not in sync with origin/master ($ahead ahead, $behind behind). Pull or push first."
}

# Tag must not already exist (locally or remotely)
if (git tag -l $tag) {
    throw "Tag $tag already exists locally. Delete it (git tag -d $tag) or bump package.json#version."
}
$remoteHit = git ls-remote --tags origin "refs/tags/$tag"
if ($remoteHit) {
    throw "Tag $tag already exists on origin. Bump package.json#version first."
}

# Best-effort: warn if no CHANGELOG entry — release notes will fall back to --generate-notes
if (Test-Path CHANGELOG.md) {
    $changelog = Get-Content CHANGELOG.md -Raw
    $marker    = "## [$version]"
    if ($changelog -notlike "*$marker*") {
        Write-Warning "CHANGELOG.md has no '$marker' entry. release.yml will use --generate-notes for the body."
    }
}

# Plan
$shortSha = (git rev-parse --short HEAD).Trim()
Write-Host ''
Write-Host ("Will create signed tag {0} on {1} and push to origin." -f $tag, $shortSha) -ForegroundColor Cyan
Write-Host  'release.yml will then package, attest provenance, GH-release, and Marketplace-publish.' -ForegroundColor Cyan

if ($DryRun) {
    Write-Host ''
    Write-Host "[DryRun] git tag -s $tag -m 'Canopy Skills $tag'" -ForegroundColor Yellow
    Write-Host "[DryRun] git push origin $tag"                    -ForegroundColor Yellow
    return
}

if (-not $Force) {
    $ok = Read-Host 'Proceed? (y/N)'
    if ($ok -ne 'y' -and $ok -ne 'Y') {
        Write-Host 'Aborted.' -ForegroundColor Yellow
        return
    }
}

# Create signed tag (Bitwarden agent will prompt for approval)
$msg = "Canopy Skills $tag"
git tag -s $tag -m $msg
if ($LASTEXITCODE -ne 0) {
    throw 'git tag -s failed. Is your signing key reachable (Bitwarden agent running, gpg.ssh.program set)?'
}

# Push the tag (don't push master — caller is responsible for that)
git push origin $tag
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Push failed; cleaning up local tag so you can retry."
    git tag -d $tag | Out-Null
    throw 'git push origin <tag> failed.'
}

Write-Host ''
Write-Host ("Pushed signed tag {0} to origin." -f $tag) -ForegroundColor Green
Write-Host  'Watch the release pipeline:' -ForegroundColor Green
Write-Host  ('  gh run watch (release.yml run for {0})' -f $tag)
