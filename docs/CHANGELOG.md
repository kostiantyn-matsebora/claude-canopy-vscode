# Changelog

All notable changes to the Canopy Skills extension are documented here.

## [0.4.0] — 2026-04-21

### Added
- **`FOR_EACH`, `SWITCH`, `CASE`, `DEFAULT` primitives** — all four new Canopy framework primitives are now recognised across diagnostics, IntelliSense completions, hover docs, and op conformance checks (synced from `claude-canopy` v0.13.0)
  - `FOR_EACH << item in collection` — requires `<<` input; iterates a collection; `BREAK` inside exits the loop
  - `SWITCH << expression` — requires `<<` input; evaluates once and dispatches to the first matching `CASE`
  - `CASE << value` — requires `<<` input; branch inside a `SWITCH` block
  - `DEFAULT` — no operators; fallback branch when no `CASE` matched
  - ops.md redefinition of any of these is now flagged as an error

### Changed
- Canopy framework version bumped to `0.13.0` (adds authoring-quality rules to canopy agent: validate/improve/create now enforce ops.md compliance, iterative VALIDATE loop in improve, extract-long-prose-to-ops and extract-commands-to-scripts rules)

## [0.3.0] — 2026-04-17

### Added
- **Semantic diagnostics** — code analysis beyond syntax highlighting for `skill.md` and `ops.md`:
  - Frontmatter: missing required `name`/`description` fields, empty values, unknown keys
  - Tree node `<<`/`>>` syntax: `>>` before `<<`, empty operators
  - Primitive signature conformance: `IF`/`ELSE_IF` without `<<`; `ASK` missing `|` options; `SHOW_PLAN` without `>>`; `VERIFY_EXPECTED` wrong path prefix; `ELSE`/`BREAK` with spurious operators; `EXPLORE` without `>>`
  - Resource reference validation: `Read \`category/path\`` uses a recognised category directory and the file exists on disk; `VERIFY_EXPECTED` target file existence check
  - Custom op conformance hints: tree node `<<`/`>>` usage compared against the op's declared signature (gated by `canopy.validate.opConformance`)
  - ops.md: warn on ops with empty bodies
- **IntelliSense tree node prefix** — accepting an op completion on a bare or indented line now inserts the correct node prefix: `* OP` for list style, `├── OP` after a `│` box-drawing indent
- `canopy.validate.opConformance` setting (boolean, default `true`) — toggle custom op signature conformance hints

### Fixed
- Unknown-op check no longer produces false positives for ALL_CAPS words appearing inside `<<` binding expressions (e.g. `MY_OP << FILE_PATH` no longer flags `FILE_PATH`)

### Changed
- Extension description updated to reflect Canopy's full scope — all eight resource types now listed
- Added `AI` to extension categories
- Repository link points to the public `claude-canopy` framework repo
- Language registration extended to all Canopy resource file types with syntax highlighting:
  - `verify/*.md` and `checklists/*.md` → `canopy-verify` (checkbox item highlighting)
  - `templates/*.md` and `templates/*.yaml` → `canopy-template` (`<token>` placeholder highlighting)
  - `constants/*.md`, `policies/*.md`, `schemas/*.md` → `canopy-resource` (table and numbered-rule highlighting)
  - `commands/*.ps1` and `commands/*.sh` → `canopy-commands` (`# === Section Name ===` header highlighting)
  - All patterns extended to cover `.github/` target in addition to `.claude/`

## [0.2.0] — 2024-06-20

### Added
- **Multi-AI-target support** for `Add as submodule` and `Add as copy (minimal files)` commands — both now prompt for **Claude** (`.claude/`) or **GitHub Copilot** (`.github/`) before proceeding
- GitHub Copilot submodule setup creates directory junctions and stubs manually since the bundled `setup.ps1/sh` scripts target `.claude/` only
- `SKILL_RESOURCES_COPILOT` constant with `.github/skills/**` globs for Copilot installs
- `sharedOpsRedirect(target)` generates redirect stub with the correct base directory per target
- Exported `AiTarget` type and `targetBaseDir()` helper shared between `setupCanopy.ts` and `canopyAgent.ts`
- **Auto-detection of AI target** in all Canopy Agent commands — checks for `skills/shared/framework/ops.md` under `.claude/` first, then `.github/`; invokes `claude "<prompt>"` or `gh copilot suggest "<prompt>"` accordingly
- Skill QuickPick in agent commands now searches both `.claude/skills/` and `.github/skills/`

## [0.1.0] — Initial release

### Added
- `canopy` language ID with filename patterns `**/.claude/**/skill.md` and `**/.claude/**/ops.md`
- Syntax highlighting via TextMate grammar (`syntaxes/canopy.tmLanguage.json`)
- Snippets for common Canopy patterns (`snippets/canopy.json`)
- Completion provider for op names, control-flow keywords, and category resource directives
- Hover provider for known op names
- Definition provider resolving `ALL_CAPS` identifiers through skill-local → project → framework lookup order
- Diagnostics provider with configurable severity for unknown ops (`canopy.validate.unknownOps`)
- `canopy.addAsSubmodule` — adds Canopy as a git submodule and runs the bundled setup script
- `canopy.addAsCopy` — shallow-clones and copies only the minimal required framework files
- `canopy.newSkill` — scaffolds `skill.md` + `ops.md`
- `canopy.newVerifyFile` — scaffolds a `verify/` checklist
- `canopy.newTemplate` — scaffolds a `templates/` file
- `canopy.newConstantsFile` — scaffolds a `constants/` file
- `canopy.newPolicyFile` — scaffolds a `policies/` file
- `canopy.newCommandsFile` — scaffolds a `commands/` script
- `canopy.newSchema` — scaffolds a `schemas/` file
- 10 Canopy Agent commands covering all agent operations (CREATE, MODIFY, SCAFFOLD, CONVERT_TO_CANOPY, VALIDATE, IMPROVE, ADVISE, REFACTOR_SKILLS, CONVERT_TO_REGULAR, HELP)
- `canopy.frameworkUrl` setting for custom framework repository URL
- `canopy.validate.enabled` and `canopy.validate.unknownOps` settings
