# === update-canopy ===
# Clone the canopy repo to a temp dir at $Version (or master if unset) and run its install.ps1.
# install.ps1 writes .canopy-version (when -Version is used) and the canopy-runtime ambient block.
param([string]$Version)
$tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName()))
try {
  $cloneArgs = @('clone', '--depth=1')
  if ($Version) { $cloneArgs += @('--branch', "v$Version") }
  $cloneArgs += @('https://github.com/kostiantyn-matsebora/claude-canopy', (Join-Path $tmp 'canopy'))
  & git @cloneArgs
  $installArgs = @('-Target', 'both')
  if ($Version) { $installArgs += @('-Version', $Version) }
  & (Join-Path $tmp 'canopy/install.ps1') @installArgs
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
