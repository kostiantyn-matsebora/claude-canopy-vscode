# Changelog

All notable changes to the Canopy Skills extension are documented here.

## [0.9.1] — 2026-04-25

### Changed

- **Publisher renamed `canopy` → `canopy-ai`** to match the registered Azure DevOps publisher at https://marketplace.visualstudio.com/manage/publishers/canopy-ai. First version published to the VS Code Marketplace.

## [0.9.0] — 2026-04-25

### Added

- **Quick Start section in README** — four numbered post-install steps covering `Canopy Install: Install...`, creating a first skill, editing with IntelliSense, and running it from the AI agent. Sublist style for readability.
- **`Install as Claude Code Plugin` auto-runs the three `/plugin` slash commands.** After launching `claude` in the integrated terminal, the extension waits ~3s for boot then sends `marketplace add` / `install` / `activate`. Leading empty newline is a safety floor — if `claude` hasn't taken over stdin yet, it lands as a harmless empty shell line. Clipboard copy stays primed and a follow-up notification points to manual paste (Ctrl+V) if Claude is slow to start.
- **Three-group Command Palette structure.** Categories are named so they sort alphabetically into a workflow order: `Canopy Install` → `Canopy Skill` → `Canopy Template`.

### Changed

- **Command Palette categories renamed and split.** `Canopy Agent` → `Canopy Skill` (11 agent commands). The single mixed `Canopy` category is split into `Canopy Install` (4 install commands) and `Canopy Template` (7 scaffold commands). `Show Version` stays in the bare `Canopy` category as a meta utility. Bug-report Area dropdown, README command tables, `CLAUDE.md`, and `TEST-PLAN-v0.17.0-sync.md` all reflect the new prefixes. The `Canopy Agent (<root>)` integrated-terminal label in `canopyAgent.ts` is intentionally unchanged — it labels the running agent, not a Command Palette group.
- **`Install as Claude Code Plugin` modal copy.** Button "Open Claude in terminal" → "Open Claude and run commands"; modal text now mentions the clipboard fallback explicitly.

## [0.8.0] — 2026-04-25

Sync with Canopy framework `v0.17.1` (was `v0.15.0`). The framework restructured around the [agentskills.io](https://agentskills.io) spec, split the runtime into a standalone `canopy-runtime` skill, switched from a bundled subtree to plugin / `gh skill` / install-script distribution, and added the `ACTIVATE` op. The extension's install commands and language support are rebuilt around the new model.

### Added

- **Three new install commands** in the `Canopy` category — replacing the deleted `Add as submodule` / `Add as copy`:
  - **`Canopy: Install...`** — unified Quick Pick of the three methods, with `$(check)`/`$(warning)`/`$(zap)` availability badges based on which CLIs (`git`, `gh skill`, `claude`) are on PATH.
  - **`Canopy: Install (via install script)`** — clone canopy + run `install.sh` / `install.ps1` (per-platform). Picks Claude / Copilot target. Multi-select Quick Pick of the three skills (canopy / canopy-runtime / canopy-debug, all checked by default); unchecked skills are deleted post-install. Requires `git`.
  - **`Canopy: Install as Agent Skill (gh skill)`** — `gh skill install` per checked skill. Picks Claude Code / GitHub Copilot agent. Writes the canopy-runtime marker block to `CLAUDE.md` / `.github/copilot-instructions.md` automatically (gh skill itself doesn't). Requires `gh ≥ 2.90.0`.
  - **`Canopy: Install as Claude Code Plugin`** — copies the three `/plugin` slash commands (`marketplace add` + `install` + `/canopy:canopy activate`) to clipboard. If `claude` CLI is detected, also offers to open Claude in the integrated terminal for paste-and-run.
- **`Canopy Agent: Debug Skill (canopy-debug)`** — new agent command that dispatches `/canopy-debug <skill>` (Claude) or `Follow .github/skills/canopy-debug/SKILL.md and trace <skill>` (Copilot), bringing the extension to **11** agent commands total.
- **Tool availability detection** (`src/availability.ts`) — `isCommandAvailable(cmd)` and `detectTools()` probe `git --version`, `gh skill --help`, `claude --version`. Used to gate install commands and surface "open download" links when a tool is missing.
- **gh-skill availability probes the `skill` subcommand specifically** — false positives on `gh < 2.90.0` (which lacks the subcommand) are eliminated.
- **claude-CLI availability check before agent dispatch** — agent commands no longer silently fail when `claude` isn't on PATH; an error dialog with an "Open Claude Code download" button surfaces instead.
- **Marker-block writer** for both `installAsAgentSkill` and the agent-installs path (`MARKER_BLOCK`, `applyMarkerBlock`, `ambientInstructionFile`, `writeAmbientMarkerBlock`) — byte-identical with `claude-canopy/install.sh build_marker_block()`. Idempotent (create / append / replace / unchanged / refuse-on-malformed).
- **`SWITCH` / `CASE` / `DEFAULT` / `FOR_EACH` primitives** added to grammar and snippets (synced from canopy v0.13.0 — were previously recognised by diagnostics only). Highlights as control-flow keywords; new snippets `switch`, `for`, `for-break`.
- **`references/` and `checklists/` categories** added to snippets `Read` resource dropdown for parity with diagnostics.
- **`license`, `metadata`, `allowed-tools`, `user-invocable`** frontmatter fields added to `FRONTMATTER_ALLOWED` / `FRONTMATTER_KEYS` / `FRONTMATTER_DOCS` (full agentskills.io spec). Closes the false-positive "unknown frontmatter field" warning on real v0.17.0 SKILL.md files.
- **Real-SKILL.md integration tests** (`src/test/realSkills.test.ts`) — load actual SKILL.md files from sibling `claude-canopy/` and from this repo's `.claude/skills/` and assert no unknown-frontmatter slips through.
- **`TEST-PLAN-v0.17.0-sync.md`** — manual UI test plan documenting all UI flows (Quick Picks, modals, snippet expansion, syntax highlighting, hover, completion, agent commands).
- **`.github/copilot-instructions.md`** — created at repo root with the canopy-runtime marker block, mirroring `CLAUDE.md` for Copilot users.
- 254 unit + integration tests passing (was 183 in 0.7.0).

### Changed

- **Canopy is no longer bundled in this repo.** `.claude/skills/canopy*` and `.github/skills/` removed. Canopy now installs as a Claude Code plugin at user scope (`/plugin install canopy@claude-canopy`); this repo's user skills (`bump-version`, `release`, `update`) load the plugin runtime ambiently via the marker block now committed to `CLAUDE.md` and `.github/copilot-instructions.md`.
- **Framework project-detection marker** updated from `<base>/canopy/skills/shared/framework/ops.md` and `<base>/skills/shared/framework/ops.md` (pre-v0.17.0 layouts) to `<base>/skills/canopy-runtime/SKILL.md`.
- **`SKILL.md` (uppercase)** is now the canonical filename per agentskills.io spec. Detection is case-insensitive across `canopyDocument.ts`, `extension.ts`, `commands/canopyAgent.ts`, `commands/newResource.ts`. New skills are scaffolded as `SKILL.md`. `package.json` filename patterns include both cases.
- **`canopy-resource` filename patterns** include `**/references/*.md` (new category in canopy v0.17.0).
- **Framework skills** (`canopy`, `canopy-runtime`, `canopy-debug`) excluded from the agent-command skill picker (`FRAMEWORK_SKILL_NAMES`).
- **Copilot agent prompt** updated to `Follow .github/skills/canopy/SKILL.md and <request>` (was `.github/agents/canopy.md` in 0.7.0).
- **`.canopy-version` source path** moved from `.claude/canopy/.canopy-version` (legacy subtree) to repo root. `scripts/sync-canopy-version.js` updated.
- **README and CLAUDE.md** rewritten — install paths, command tables, sync-points, source layout all reflect v0.17.0+.
- **`docs/DEVELOPMENT.md`** updated — source layout, test coverage map, op-lookup chain, and primitive/category sync checklists all reflect the post-v0.17.0 codebase.

### Removed

- **`canopy.addAsSubmodule`** and **`canopy.addAsCopy`** commands — superseded by the four new install commands.
- **`src/commands/setupCanopy.ts`** — its scaffolding logic was tied to the legacy v0.16-and-earlier `shared/framework/ops.md` layout; replaced by `src/commands/installCanopy.ts`.
- **Bundled framework skills** (`canopy`, `canopy-runtime`, `canopy-debug`) under `.claude/skills/` and the entire `.github/skills/` tree.

### Fixed

- Plugin-install path UX gap: the `/plugin install canopy@claude-canopy` flow now includes `/canopy:canopy activate` as a third step in the clipboard copy and modal text — without it, user-authored canopy skills under `.claude/skills/` weren't runtime-active because plugin install doesn't write the ambient marker block.
- Tests for `canopyAgent` updated to use SKILL.md and the v0.17.0 marker (`skills/canopy-runtime/SKILL.md`) instead of the deleted subtree-flat marker pair.

## [0.7.0] — 2026-04-22

### Fixed
- `Canopy Agent: *` commands dispatched the terminal from the wrong directory in multi-project workspaces, so the Claude CLI started without `/canopy` in scope and the invocation silently failed. Project selection now walks up from the active editor file to the nearest ancestor containing `<base>/canopy/skills/shared/framework/ops.md`; falls back to scanning workspace folders; and shows a QuickPick when multiple projects are open (e.g. the canopy dev workspace itself, where both `claude-canopy-examples` and `claude-canopy-vscode` carry `.claude/canopy/`). Terminals are now cached per project root so each project gets its own `Canopy Agent (<project>)` terminal.
- `pickSkill` previously unioned skill names across every workspace folder — a skill from project A could be picked then dispatched in project B. The picker is now scoped to the resolved project.

### Added
- Current-skill shortcut in the skill picker. When the active editor is inside a skill directory (`<base>/skills/<name>/...` or `<base>/canopy/skills/<name>/...`, any file — `skill.md`, `ops.md`, policies, templates, schemas, verify, etc.), that skill is promoted to the top of the `Improve / Validate / Modify / ConvertToCanopy / ConvertToRegular` picker with a `(current file)` description, pre-selected for one-Enter dispatch. Other skills remain available below it, plus the existing manual-entry option.
- Error notification when no Canopy project is present in the workspace (previously silently defaulted to `claude` and opened a terminal at an arbitrary directory).
- Exported pure helpers `projectTargetAt`, `findProjectUpward`, `resolveProjectFromPaths`, `detectCurrentSkill` with 14 new Vitest cases covering hint-based resolution, workspace-folder fallback, multi-project ambiguity, subtree skills, and the shared/ pseudo-skill exclusion.

## [0.6.0] — 2026-04-22

### Fixed
- `Canopy Agent: *` commands now invoke the agent using the documented runtime forms: `claude "/canopy <request>"` for Claude Code (per `runtimes/claude.md`) and `Follow .github/agents/canopy.md and <request>` opened in VS Code Chat for Copilot (per `runtimes/copilot.md`). Previously used `claude "canopy: ..."` and `gh copilot suggest "canopy: ..."` — the former used an undocumented `canopy:` prefix instead of the `/canopy` slash command, and the latter targeted the shell-command helper, not the chat agent.
- Extracted `buildAgentPrompt` / `buildClaudeCliCommand` as pure helpers and added `src/test/canopyAgent.test.ts` covering both runtime shapes.

## [0.5.1] — 2026-04-22

### Changed
- README reorganised: `Installation` promoted to the top (right after `What is Canopy?`), `Commands` moved above `Features`, and `Agent` commands emphasised as the beginner-friendly starting point (no framework knowledge required) while `Scaffold` commands are reframed as the manual authoring path for framework-familiar authors.
- `IntelliSense` and `Semantic diagnostics` bullets converted to tables for scanability.
- `What this extension does` condensed from a bullet list to a two-sentence overview.

## [0.5.0] — 2026-04-22

### Added
- Screenshots (autocomplete, diagnostics, hover docs) and a new **In action** section in the README.
- `galleryBanner`, `bugs`, and `homepage` fields in `package.json` for a richer VS Code Marketplace listing once published.
- Quick start section in the README.
- `LICENSE` and GitHub Release badges in the README.

### Changed
- `CHANGELOG.md` moved from `docs/` to the repo root so the VS Code Marketplace Changelog tab will surface it once published.
- Installation section rewritten around the GitHub Release `.vsix` download — the actual distribution channel until the Marketplace listing is live.

### Fixed
- `repository.url` in `package.json` pointed at the framework repo instead of this extension's repo.

## [0.4.3] — 2026-04-21

### Changed
- Canopy framework version bumped to `0.15.0` — policy consolidation (5 policy files merged into `authoring-rules.md`), apply-block protocol extracted to `constants/apply-block-protocol.md`, validate-checks catalog extracted to `constants/validate-checks.md`, new `## Agent` body shape rules (three canonical shapes: A minimal / B sub-task bullets / C op reference) with VALIDATE checks for inline mappings / quoted examples / schema-field-list violations, runtime specs updated to resolve shape (C) op references

### Fixed
- `Setup Canopy` command now emits `skill-resources.md` with the `checklists/` category row and the `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH` primitives (previously missing from both `.claude` and `.github` template variants)

## [0.4.2] — 2026-04-21

### Fixed
- Auto-assign `canopy` language for `skill.md` and `ops.md` files inside `.claude/` and `.github/` directories when another extension wins the initial language detection race — status bar now always shows "Canopy Skill" for these files
- Release workflow now dispatches directly from `tag-on-merge` instead of relying on GitHub's push-tag cascade, which does not reliably fire for workflow-created tags
- Job-level env expression replaced with a `resolve-tag` step in `release.yml` to fix `workflow_dispatch` trigger not being recognised

## [0.4.1] — 2026-04-21

### Changed
- Canopy framework version bumped to `0.14.0` — VALIDATE now explicitly checks every tree node (including `Report:`, natural language steps, and op descriptions) for inline static content (→ `constants/`) and inline parameterised content (→ `templates/`); procedural note added to iterate every node for content-class rules rather than relying on a holistic scan

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
