# Changelog

All notable changes to the Canopy Skills extension are documented here.

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
