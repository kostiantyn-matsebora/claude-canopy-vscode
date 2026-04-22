# Canopy setup script
# Run from your project root after placing Canopy at <base>/canopy/ via any method:
#   git submodule add <url> <base>/canopy
#   git subtree add --prefix=<base>/canopy <url> main --squash
#   pwsh install.ps1 [version] [-Target claude|copilot]
#
# Creates the wiring files that Claude Code or GitHub Copilot needs to see both
# canopy internals and your own skills. Safe to re-run - existing files are never
# overwritten.
#
# Usage:
#   pwsh setup.ps1                       # wire Claude Code (default)
#   pwsh setup.ps1 -Target copilot       # wire GitHub Copilot

param(
    [ValidateSet('claude','copilot')]
    [string]$Target = 'claude'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Target -eq 'copilot') { $Base = '.github' } else { $Base = '.claude' }
$CanopyDir   = "$Base/canopy"
$SkillsDir   = "$Base/skills"
$AgentsDir   = "$Base/agents"
$ProjectOps  = "$Base/skills/shared/project/ops.md"
$SharedOps   = "$Base/skills/shared/ops.md"
$RulesFile   = ".claude/rules/skill-resources.md"       # Claude only
$CopilotInst = ".github/copilot-instructions.md"        # Copilot only
$CopilotMark = "<!-- canopy:skill-resources:start -->"

function Write-Created { param($Path) Write-Host "  created  $Path" -ForegroundColor Green }
function Write-Skipped { param($Path) Write-Host "  exists   $Path  (skipped)" -ForegroundColor Yellow }
function Write-Appended { param($Path) Write-Host "  appended $Path" -ForegroundColor Green }
function Write-Err     { param($Msg)  Write-Host "  error    $Msg" -ForegroundColor Red; exit 1 }

Write-Host "Canopy setup"
Write-Host "------------"
Write-Host "  target   $Target ($Base/)"

# Verify Canopy is present
if (-not (Test-Path "$CanopyDir/docs/FRAMEWORK.md")) {
    Write-Err "$CanopyDir not found. Place Canopy there first: submodule, subtree, or pwsh install.ps1"
}

# Create base directories
New-Item -ItemType Directory -Force -Path "$Base/skills/shared/project" | Out-Null
New-Item -ItemType Directory -Force -Path $AgentsDir | Out-Null
if ($Target -eq 'claude') {
    New-Item -ItemType Directory -Force -Path ".claude/rules" | Out-Null
}

# -- Junction links for bundled canopy skills ----------------------------------
# VS Code does not scan inside git submodules for skill discovery.
# Create directory junctions in <base>/skills/ so each bundled skill is visible.
Get-ChildItem "$CanopyDir/skills" -Directory |
    Where-Object { $_.Name -ne "shared" } |
    ForEach-Object {
        $JunctionPath = "$SkillsDir/$($_.Name)"
        if (Test-Path $JunctionPath) {
            Write-Skipped $JunctionPath
        } else {
            $AbsTarget = Resolve-Path $_.FullName
            New-Item -ItemType Junction -Path $JunctionPath -Target $AbsTarget | Out-Null
            Write-Created "$JunctionPath -> $AbsTarget"
        }
    }

# -- Links for bundled canopy agents -------------------------------------------
# Claude Code / Copilot looks for agents in <base>/agents/ - link each bundled
# agent file and its resource directory so they are visible outside the submodule.
# Note: file symbolic links (SymbolicLink) require Windows Developer Mode or
# admin privileges. If New-Item -ItemType SymbolicLink fails, copy the .md files
# manually into <base>/agents/.
$CanopyAgentsDir = "$CanopyDir/agents"
if (Test-Path $CanopyAgentsDir) {
    # Agent .md files - use SymbolicLink (files, not directories)
    Get-ChildItem $CanopyAgentsDir -Filter "*.md" -File |
        ForEach-Object {
            $LinkPath = "$AgentsDir/$($_.Name)"
            if (Test-Path $LinkPath) {
                Write-Skipped $LinkPath
            } else {
                $AgentFile = $_
                $RelTarget = "../canopy/agents/$($AgentFile.Name)"
                try {
                    New-Item -ItemType SymbolicLink -Path $LinkPath -Target $RelTarget | Out-Null
                    Write-Created "$LinkPath -> $RelTarget"
                } catch {
                    # Fallback: copy if symlink creation requires elevated privileges
                    $AbsTarget = Resolve-Path $AgentFile.FullName
                    Copy-Item $AbsTarget $LinkPath
                    Write-Created "$LinkPath  (copied; symlink requires Developer Mode)"
                }
            }
        }
    # Agent resource directories - use Junction (directory links work without elevation)
    Get-ChildItem $CanopyAgentsDir -Directory |
        ForEach-Object {
            $JunctionPath = "$AgentsDir/$($_.Name)"
            if (Test-Path $JunctionPath) {
                Write-Skipped $JunctionPath
            } else {
                $AbsTarget = Resolve-Path $_.FullName
                New-Item -ItemType Junction -Path $JunctionPath -Target $AbsTarget | Out-Null
                Write-Created "$JunctionPath -> $AbsTarget"
            }
        }
}

# -- Ambient skill-resource rules ---------------------------------------------
# Claude: write .claude/rules/skill-resources.md (with globs frontmatter)
# Copilot: append a marker-delimited section to .github/copilot-instructions.md
#          (Copilot has no glob-based ambient rules — see runtimes/copilot.md)
if ($Target -eq 'claude') {
    if (Test-Path $RulesFile) {
        Write-Skipped $RulesFile
    } else {
        @'
---
globs: [".claude/skills/**", ".claude/canopy/skills/**"]
---

# Skill Resource Conventions

This file is generated by `setup.sh`/`setup.ps1` when Canopy is at `.claude/canopy/`.
It covers both your project skills and canopy's bundled skills.

---

## Category behavior

When a skill step says `Read <category>/<file>`, the directory determines behavior:

| Category | File types | Behavior |
|----------|------------|----------|
| `schemas/` | `.json`, `.md` | Use as subagent output contract or input parameter definition |
| `templates/` | `.yaml`, `.md`, `.yaml.gotmpl` | Substitute all `<token>` placeholders from step context; write to target path stated in step |
| `commands/` | `.ps1`, `.sh` | Execute the section identified with `for <operation>`; capture named output values stated in step |
| `constants/` | `.md` | Load all named values into step context; reference by name in subsequent steps |
| `checklists/` | `.md` | Iterate `- [ ]` items as evaluation criteria during the relevant op |
| `policies/` | `.md` | Apply as active rules for the duration of the skill |
| `verify/` | `.md` | Use as expected-state checklist during the verification phase |

## Named operations

When a step or tree node contains an ALL_CAPS identifier:
1. Look up in `<skill>/ops.md` first (skill-local ops)
2. Fall back to `.claude/skills/shared/project/ops.md` (project-wide ops)
3. Fall back to `.claude/canopy/skills/shared/framework/ops.md` (framework primitives)

`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED` are primitives -- always in `shared/framework/ops.md`.

## Tree format

When a skill has `## Tree` instead of `## Steps`: execute the tree top-to-bottom as a sequential pipeline.

Each node is either an op call (`OP_NAME << inputs >> outputs`) or natural language -- both are valid.
`IF` nodes branch on condition; both branches may be op calls or natural language.
Op definitions in `<skill>/ops.md`, `shared/project/ops.md`, and `shared/framework/ops.md` may also use tree notation internally.

## Explore subagent

When a skill has a `## Agent` section declaring `**explore**`:
- Launch an Explore subagent with the task described in that section
- Do NOT inline-read files yourself
- Use `schemas/explore-schema.json` as the output contract; return JSON only
'@ | Set-Content -Encoding UTF8 $RulesFile
        Write-Created $RulesFile
    }
} else {
    # Copilot: append under a marker if not already present
    $existing = if (Test-Path $CopilotInst) { Get-Content $CopilotInst -Raw } else { "" }
    if ($existing -match [regex]::Escape($CopilotMark)) {
        Write-Skipped $CopilotInst
    } else {
        $Section = @'

<!-- canopy:skill-resources:start -->
## Canopy Skill Resources

This section is generated by `setup.sh`/`setup.ps1` when Canopy is at `.github/canopy/`.
It covers both your project skills and canopy's bundled skills.

### Category behavior

When a skill step says `Read <category>/<file>`, the directory determines behavior:

| Category | File types | Behavior |
|----------|------------|----------|
| `schemas/` | `.json`, `.md` | Use as subagent output contract or input parameter definition |
| `templates/` | `.yaml`, `.md`, `.yaml.gotmpl` | Substitute all `<token>` placeholders from step context; write to target path stated in step |
| `commands/` | `.ps1`, `.sh` | Execute the section identified with `for <operation>`; capture named output values stated in step |
| `constants/` | `.md` | Load all named values into step context; reference by name in subsequent steps |
| `checklists/` | `.md` | Iterate `- [ ]` items as evaluation criteria during the relevant op |
| `policies/` | `.md` | Apply as active rules for the duration of the skill |
| `verify/` | `.md` | Use as expected-state checklist during the verification phase |

### Named operations

When a step or tree node contains an ALL_CAPS identifier:
1. Look up in `<skill>/ops.md` first (skill-local ops)
2. Fall back to `.github/skills/shared/project/ops.md` (project-wide ops)
3. Fall back to `.github/canopy/skills/shared/framework/ops.md` (framework primitives)

`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED` are primitives -- always in `shared/framework/ops.md`.

### Tree format

When a skill has `## Tree` instead of `## Steps`: execute the tree top-to-bottom as a sequential pipeline.

Each node is either an op call (`OP_NAME << inputs >> outputs`) or natural language -- both are valid.
`IF` nodes branch on condition; both branches may be op calls or natural language.
Op definitions in `<skill>/ops.md`, `shared/project/ops.md`, and `shared/framework/ops.md` may also use tree notation internally.

### Explore subagent (inline fallback)

When a skill has a `## Agent` section declaring `**explore**`:
- Native subagents are not supported on Copilot
- Read the files described in the `## Agent` body sequentially at the start of execution, before the first tree node
- Treat all gathered content as `context`, structured to match `schemas/explore-schema.json`
- The first tree node (`EXPLORE >> context`) is satisfied by this inline reading step
<!-- canopy:skill-resources:end -->
'@
        Add-Content -Path $CopilotInst -Value $Section -Encoding UTF8
        if ($existing -eq "") { Write-Created $CopilotInst } else { Write-Appended $CopilotInst }
    }
}

# -- <base>/skills/shared/project/ops.md --------------------------------------
if (Test-Path $ProjectOps) {
    Write-Skipped $ProjectOps
} else {
    @'
# Project-Wide Ops

Shared ops specific to this project. Available to all skills; not portable to other projects without adaptation.

Add an op here when:
- The same multi-step pattern appears in 2 or more skills
- The behavior is complex enough to warrant a named abstraction
- The op involves project-specific tools, APIs, or conventions

Notation: `<<` input source or options, `>>` captured output or displayed fields, `|` item separator.
Op definitions may use tree notation internally (same syntax as skill.md `## Tree`).

---

# -- Examples (commented out -- uncomment and adapt for your project) ----------

# ## MY_DEPLOY << dir
#
# Deploy the application in `<dir>`.
# 1. Run dry-run: show diff
# 2. ASK << Proceed? | Yes | No
# 3. Apply changes

# ## MY_VERIFY << namespace
#
# Check that all pods in `<namespace>` are Running/Ready.
# Report any pods that are not ready after 2 minutes.

# ## MY_SECRET_READ << path >> {fields}
#
# Read secret at `<path>` from the project secret store.
# Capture named `{fields}` into step context.

# ## MY_SECRET_WRITE << path << {fields}
#
# Write `{fields}` to `<path>` in the project secret store.
# Patch if path exists; create if new.

# ------------------------------------------------------------------------------
'@ | Set-Content -Encoding UTF8 $ProjectOps
    Write-Created $ProjectOps
}

# -- <base>/skills/shared/ops.md ----------------------------------------------
if (Test-Path $SharedOps) {
    Write-Skipped $SharedOps
} else {
    $SharedBody = @"
# Shared Ops -- Redirected

This file has been split. Use the files below directly or rely on the three-level lookup order.

- **Framework primitives** (IF, ASK, SHOW_PLAN, ...) -> ``$Base/canopy/skills/shared/framework/ops.md``
- **Project-wide ops** (project-specific patterns) -> ``$Base/skills/shared/project/ops.md``
"@
    Set-Content -Encoding UTF8 -Path $SharedOps -Value $SharedBody
    Write-Created $SharedOps
}

Write-Host ""
Write-Host "Done. Your project is wired for Canopy ($Target)."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add your skills under $SkillsDir/<skill-name>/"
Write-Host "  2. Add your agents under $AgentsDir/"
Write-Host "  3. Add project-wide ops to $ProjectOps"
Write-Host "  4. Update Canopy later:"
Write-Host "       submodule:  git submodule update --remote $CanopyDir"
Write-Host "       subtree:    git subtree pull --prefix=$CanopyDir <url> main --squash"
Write-Host "       vendored:   pwsh install.ps1 [version] -Target $Target"
