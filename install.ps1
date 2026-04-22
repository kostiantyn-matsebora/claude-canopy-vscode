# Canopy installer for Windows — downloads a release and wires Claude Code or GitHub Copilot.
# Usage:
#   pwsh install.ps1                              # install latest release, wire Claude Code
#   pwsh install.ps1 -Target copilot              # install latest release, wire GitHub Copilot
#   pwsh install.ps1 v1.0.0                       # install specific version (Claude)
#   pwsh install.ps1 v1.0.0 -Target copilot       # install specific version (Copilot)
#   irm <url>/install.ps1 | iex                   # install latest via web pipe

param(
    [string]$Version = "",
    [ValidateSet('claude','copilot')]
    [string]$Target = 'claude'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repo        = "kostiantyn-matsebora/claude-canopy"
$Base        = if ($Target -eq 'copilot') { ".github" } else { ".claude" }
$CanopyDir   = Join-Path $Base "canopy"
$VersionFile = ".canopy-version"

function Write-Info  { param($Msg) Write-Host "  info     $Msg" -ForegroundColor Green }
function Write-Err   { param($Msg) Write-Host "  error    $Msg" -ForegroundColor Red; exit 1 }

if (-not $Version) {
    Write-Info "Fetching latest release..."
    $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $Release.tag_name
    if (-not $Version) { Write-Err "Could not determine latest version. Specify one: pwsh install.ps1 v1.0.0" }
}

Write-Host "Canopy installer"
Write-Host "----------------"
Write-Info "Target:  $Target ($Base/)"
Write-Info "Version: $Version"

$TarballUrl = "https://github.com/$Repo/archive/refs/tags/$Version.tar.gz"
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    $TmpFile = Join-Path $TmpDir "canopy.tar.gz"
    Write-Info "Downloading $TarballUrl"
    Invoke-WebRequest -Uri $TarballUrl -OutFile $TmpFile -UseBasicParsing

    $ExtractDir = Join-Path $TmpDir "extract"
    New-Item -ItemType Directory -Path $ExtractDir | Out-Null
    tar -xzf $TmpFile --strip-components=1 -C $ExtractDir

    New-Item -ItemType Directory -Force -Path $CanopyDir | Out-Null
    Copy-Item "$ExtractDir/*" $CanopyDir -Recurse -Force
    Set-Content -Path $VersionFile -Value $Version -NoNewline
    Write-Info "Installed to $CanopyDir/ ($VersionFile updated)"
} finally {
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
pwsh "$CanopyDir/setup.ps1" -Target $Target
