# Changelog

All notable changes to the Canopy Skills extension are documented here.

## [0.13.0] — 2026-05-09

Sync to canopy v0.20.0. Adds language-server support for the new **subagent dispatch model** — per-op markers + bold call-sites that flag a tree node for out-of-context subagent execution.

### Added

- **Bold-wrapped op call recognition** (`canopyDocument.ts`):
  - `parseTreeLine` detects `**OP_NAME**` at the start of a tree node and sets `subagentCall = true` on the resulting `TreeNode`. The bold wrapping is stripped before downstream parsing so `<<` / `>>` extraction and op-name resolution work uniformly with the inline form.
  - List-bullet stripper tightened (`/^\s*\*(?:\s|$)/`) so it no longer eats one of the `**` markers in a leading bold-wrapped op name.
- **Subagent op-def marker parsing** (`canopyDocument.ts`):
  - `parseOpDefinitions` now invokes `parseSubagentMarker()` to detect a `> **Subagent.**` blockquote as the first non-blank content under an op heading. The blockquote may span multiple lines and carries `Output contract: \`<schema-path>\`` (mandatory) and optionally `Input contract: \`<schema-path>\``.
  - New optional fields on `OpDefinition`: `isSubagent`, `outputContract`, `inputContract`, `markerLine`.
- **S2 diagnostics** (`diagnosticsProvider.ts`):
  - **Bold marker on framework primitive → warning.** `**EXPLORE** >> ctx` etc. surfaces as misuse — primitives have fixed dispatch.
  - **Call-site bold without op-def marker → warning.** A bold-wrapped op invocation whose definition has no `> **Subagent.**` marker triggers a "definition has no marker" warning, asking the author to either add the marker or drop the bold wrapping.
  - **Subagent marker missing Output contract → warning.** Subagent ops must declare an output schema.
  - **Output / Input contract file does not exist → warning.** Schema paths resolve relative to the skill root (walked up from the ops file).
- **Subagent-aware hover** (`hoverProvider.ts`):
  - Op tooltip annotates subagent dispatch (`(skill-local op, subagent dispatch)`).
  - Includes the contract paths inline when present.
- **Goto-definition for schema references** (`definitionProvider.ts`):
  - Cursor on the path inside `Output contract: \`...\`` or `Input contract: \`...\`` jumps to the JSON schema file (resolved relative to the skill root).
- **TextMate grammar scopes** (`syntaxes/canopy.tmLanguage.json`):
  - `subagent-call` — highlights `**OP_NAME**` distinctly from inline op calls.
  - `subagent-marker` — highlights the `> **Subagent.**` blockquote on op definitions.
- **Snippets** (`snippets/canopy.json`):
  - `op-subagent` — full subagent op-def skeleton (heading + marker blockquote + tree-form body).
  - `call-subagent` — bold-wrapped call-site one-liner.

### Changed

- **`canopyVersion`** in `package.json`: `0.19.0` → `0.20.0`.
- **Extension version**: `0.12.0` → `0.13.0` (minor — new feature support).
- **`.canopy-version`**: `0.18.1` → `0.20.0`.
- **README "Tracks framework v…" line**: `v0.18.1` → `v0.20.0`. Stale README copy was the trigger for the new rule entry in `.claude/rules/keep-in-sync.md` calling out all three version-tracking strings (canopyVersion, .canopy-version, README sentence) as a group.

### Tests

- 11 new tests in `canopyDocument.test.ts`:
  - 5 for call-site bold detection (plain vs. bold, with/without operators, box-drawing form, lowercase `**explore**` is NOT a bold-op-call).
  - 5 for op-def marker detection (no marker, marker + Output contract, marker + both contracts, marker not first non-blank, non-canonical marker text).
- 8 new tests in `diagnosticsProvider.test.ts`:
  - 3 for call-site checks (primitive misuse, primitive without bold is clean, unknown-op stays silent for marker mismatch).
  - 5 for op-def marker checks (missing Output contract, missing schema file, valid schema, missing Input file, plain op without marker).

### Notes

- **Marker block parity** — content unchanged in framework v0.20.0; the `MARKER_BLOCK` constant in `installCanopy.ts` is in sync without modification.
- **Soft-compat with `## Agent` + `EXPLORE`** — legacy skills using the `## Agent` section continue to validate; nothing forces migration. The lowercase `**explore**` body marker is intentionally distinct from the uppercase `**OP_NAME**` subagent-call regex.

## [0.12.0] — 2026-05-09

Sync to canopy v0.19.0. Adds language-server support for the new `PARALLEL` block primitive — heterogeneous parallel-subagent fan-out as a real grammar element.

### Added

- **`PARALLEL` primitive** wired through every extension surface that touches the framework's primitive set:
  - `RESERVED_PRIMITIVES` set (`diagnosticsProvider.ts`)
  - `PRIMITIVES` set (`canopyDocument.ts`)
  - `PRIMITIVE_DOCS.PARALLEL` entry with signature, description, and tree example (`opRegistry.ts`) — drives hover docs and completion items
  - `primitive-control` regex + `op-call` negative lookahead (`syntaxes/canopy.tmLanguage.json`) so `PARALLEL` highlights as a control-flow keyword, not a custom op
  - `parallel` snippet (`snippets/canopy.json`) — expands to a 2-child `PARALLEL` block skeleton
  - Marker-block constant (`installCanopy.ts`) — control-flow primitives list updated; parity with framework v0.19.0 marker block is restored
- **`checkPrimitiveSignatures()` `PARALLEL` case** (`diagnosticsProvider.ts`):
  - Errors when the node carries `<<` or `>>` (PARALLEL takes no input or output)
  - Hints when the block has fewer than 2 direct children (no fan-out benefit)
- **`countDirectChildren()` helper** (`diagnosticsProvider.ts`) — counts indented children of a tree node by walking forward until indent ≤ parent. First child's indent defines the "direct child" level. New utility; reusable for future primitives that need child-count rules.

### Changed

- **`canopyVersion`** in `package.json`: `0.18.1` → `0.19.0` (tracking the framework release that introduced PARALLEL).
- **Extension version**: `0.11.2` → `0.12.0` (minor — new feature support).

### Fixed

- **`ASK` free-form input no longer flagged as a warning** (`diagnosticsProvider.ts`): `ASK << question` without `|`-separated options is a valid mode — the runtime renders the question and accepts whatever the user types. The previous "requires at least one option separated by '|'" warning was overly strict and false-flagged legitimate free-form prompts. Error still fires when `ASK` has no input at all (a question is required).
- **`PRIMITIVE_DOCS.ASK`** updated to document both modes (multiple-choice + free-form) in the signature, description, and example.

### Tests

- 5 new vitest cases in `diagnosticsProvider.test.ts`:
  - `PARALLEL << foo` → error
  - `PARALLEL >> result` → error
  - `PARALLEL` with 1 child → hint
  - `PARALLEL` with 0 children → hint
  - `PARALLEL` with ≥2 children, no input/output → clean
- 1 new entry in the parameterised "ops.md redefining new primitives" test (`PARALLEL` joins the existing `FOR_EACH/SWITCH/CASE/DEFAULT` set).
- Replaced "warns when ASK input has no | option separator" with "no warning when ASK has free-form input (no options)" — same test slot, opposite expectation, matching the fixed behavior.

## [0.11.2] — 2026-05-05

Bug-fix release. Cleans up the last legacy-flat-layout artifacts left over from the v0.11.0 sync to canopy v0.18.1 — every real canopy v0.18.0+ skill now validates without false positives.

### Fixed

- **`assets/<sub>/` Read-ref category extraction** (`canopyDocument.ts`): the parser now recognizes two-segment categories (`assets/policies/`, `assets/constants/`, `assets/schemas/`, `assets/templates/`, `assets/checklists/`, `assets/verify/`). Previously every Read path under the v0.18.0 standard layout collapsed to single-segment `assets/` and triggered an "Unknown resource category 'assets/'" warning on every line.
- **`VERIFY_EXPECTED` accepts both prefixes** (`diagnosticsProvider.ts`): `VERIFY_EXPECTED << assets/verify/<file>.md` no longer triggers a "must start with 'verify/'" warning. Both legacy `verify/` and agentskills `assets/verify/` are valid.
- **Plain ` ``` ` fence in `## Tree` allowed** (`diagnosticsProvider.ts`): box-drawing trees wrapped in a plain code fence — the canonical syntax per `docs/FRAMEWORK.md` — no longer trigger "should not contain inline code blocks". The warning is now scoped to fences with an explicit info string (` ```yaml `, ` ```json `, etc.) — the actual structural-content case it's meant to flag.

### Changed

- **`PRIMITIVE_DOCS.VERIFY_EXPECTED`** (`opRegistry.ts`): hover signature/example show `assets/verify/<file>.md` (preferred); description notes legacy `verify/` is also accepted.
- **`## Agent` hover docs** (`hoverProvider.ts`): output-contract reference updated from `schemas/explore-schema.json` to `assets/schemas/explore-schema.json` (with legacy fallback noted).
- **`verifyMatch` completion regex** (`completionProvider.ts`): matches both `verify/` and `assets/verify/` after `VERIFY_EXPECTED <<`.
- **Snippets modernized** (`snippets/canopy.json`):
  - `skill` / `skill-explore` expansions now produce spec-compliant frontmatter (free-text `compatibility`, `metadata.argument-hint`, structured safety preamble) and use `assets/verify/verify-expected.md`.
  - `verify` snippet defaults to `assets/verify/`.
  - `read` snippet's category dropdown lists agentskills paths first (`assets/schemas`, `assets/templates`, `assets/constants`, `assets/policies`, `assets/verify`, `assets/checklists`, `scripts`, `references`), legacy paths after.
- **TextMate `frontmatter-known-key`** (`syntaxes/canopy.tmLanguage.json`): highlights all canonical agentskills.io root keys (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) plus legacy `argument-hint` / `user-invocable` for visual parity. Diagnostics still flag the latter as needing to live inside `metadata`.
- **Command title rename**: `canopy.newCommandsFile` title is now "New Script File" (was "New Commands File"). The function already wrote to `scripts/`; only the user-visible label was stale. Command id unchanged — keybindings preserved.

### Tests

- **Test baseline: 337/337** (was 323/323). 14 new tests:
  - 6 in `canopyDocument.test.ts` for `assets/<sub>/` category extraction across all six sub-directories.
  - 8 in `diagnosticsProvider.test.ts`: 6 for agentskills-path category-acceptance, 1 for plain-fence allowance, 1 for agentskills `VERIFY_EXPECTED` prefix; the original code-block test was rewritten to assert against ` ```yaml ` instead of plain ` ``` `.
- **New scenarios in `docs/TEST_SCENARIOS.md`**: Suite C9 (Layout-migration diagnostics) and C6.6 (Layout-migration UX manual smoke).

### Notes

- **No `canopyVersion` change** — still tracks canopy `0.18.1`.

---

## [0.11.1] — 2026-04-30

Patch release. No extension behavior changes.

### Changed

- **Marketplace tags trimmed for real.** The 0.11.0 release left language `aliases` populated, which the VS Code Marketplace harvests as user-visible tags — leading to a noisy listing (`Canopy Resource`, `Canopy Scripts`, `Canopy Skill`, `Canopy Template`, `Canopy Verify`, plus `canopy-resource`, `canopy-scripts`, `canopy-template`, `canopy-verify`). Cleanup:
  - `canopy` language → aliases collapsed from `["Canopy Skill", "canopy"]` to `["Canopy"]`.
  - `canopy-verify`, `canopy-template`, `canopy-resource`, `canopy-scripts` → aliases set to `[]`. VS Code falls back to the language `id` for the picker.
- **Release flow signed by the maintainer.** `tag-on-merge.yml` removed; `scripts/release.ps1` is the new entry point. Reads `package.json#version`, validates state, runs `git tag -s` via the Bitwarden SSH agent, pushes the signed tag. `release.yml` (unchanged) still attests SLSA build provenance + GitHub Release + Marketplace publish.

### Notes

- **No `canopyVersion` change** — still tracks canopy `0.18.1`.

---

## [0.11.0] — 2026-04-30

**Sync with Canopy framework `v0.18.1`** (was `v0.17.1`).

**Headline framework changes absorbed:**

- agentskills.io standard skill layout — only `SKILL.md` at the skill root; `scripts/` for executable code; `references/` for docs loaded on demand (incl. `ops.md` / `ops/`); `assets/` for static resources.
- `compatibility` is a free-text string per spec (was structured object).
- canopy-runtime activation is agent-mediated (was install-tool-mediated for plugin / `gh skill` paths).
- Cross-client install target at `.agents/skills/`.

**Extension impact:** language IDs, diagnostics, snippets, and templates rebuilt around the new model. Backward-compatible with legacy flat-layout skills.

### Added

- **Compatibility-shape diagnostics** (`diagnosticsProvider.ts`) — flags non-spec `compatibility` shapes per agentskills.io:
  - **Warning** on block-form YAML map (`compatibility:\n  requires:\n    - foo`) — migration hint to free-text form.
  - **Warning** on inline-flow map (`compatibility: { requires: [foo] }`) — same migration hint.
  - **Warning** on values exceeding 500 characters (spec limit).
  - **Warning** on `## Tree` skills missing the `compatibility` field entirely.
  - **Hint** on string-form `compatibility` that doesn't mention `canopy-runtime` (canopy-flavored skills only).
- **Cross-client install target** in install pickers (`installCanopy.ts`, `installMethodPicks.ts`):
  - **Quick Pick:** Cross-client (`.agents/skills/`) added alongside Claude Code / Copilot / Both.
  - **`gh skill install` flow:** uses `--dir .agents/skills`.
  - **Install-script flow:** passes `--target agents` / `-Target agents`.
- **`.agents/skills/` in language ID file patterns** — patterns now match all three roots (`.agents/skills/`, `.claude/skills/`, `.github/skills/`).
- **agentskills.io standard-layout patterns** in all five language IDs:
  - **`canopy`** matches `**/references/ops.md`, `**/references/ops/*.md` (in addition to legacy `**/ops.md`).
  - **`canopy-verify`** matches `**/assets/verify/*.md`, `**/assets/checklists/*.md`.
  - **`canopy-template`** matches `**/assets/templates/*.md`, `**/assets/templates/*.yaml`.
  - **`canopy-resource`** matches `**/assets/constants/*.md`, `**/assets/policies/*.md`, `**/assets/schemas/*.md`.
  - **`canopy-commands`** matches `**/scripts/*.ps1`, `**/scripts/*.sh` (legacy `commands/` still recognised).
- **Test baseline: 276/276** (was 254/254). Two new tests in `diagnosticsProvider.test.ts` cover block-form and inline-flow `compatibility` rejection.
- **`Canopy Template: New Skill`** scaffolds the canonical layout:
  - `references/ops.md`
  - `assets/{templates,constants,schemas,checklists,policies,verify}/`
  - Spec-compliant frontmatter (free-text `compatibility`, `metadata.argument-hint`)
  - Structured safety preamble.

### Changed

- **`compatibility` hover doc** (`hoverProvider.ts`) — rewritten:
  - Describes the canonical free-text form (≤500 chars, names canopy-runtime + source repo, lists install tools as alternatives).
  - Warns about the YAML colon-space gotcha.
  - Points at `/canopy improve` for migrating structured shapes.
- **`SKILL.md` template** (`commands/newResource.ts`):
  - Inserts canonical `compatibility` value.
  - Inserts the structured safety preamble (labeled bullets, not stream-of-consciousness).
  - Uses canonical layout paths (`assets/`, `references/`, `scripts/`).
- **Marker block** (`installCanopy.ts`, `MARKER_BLOCK` constant) — mirrors canopy v0.18.1:
  - **Restructured** as bulleted lists with nested items.
  - **References all three skills roots** (`.agents/skills/`, `.claude/skills/`, `.github/skills/`).
  - **Parity check** across `marker-block.md` (now in `canopy-runtime/assets/constants/`), `install.sh build_marker_block()`, `install.ps1 Build-MarkerBlock`, and this constant still enforced.
- **Real-skills test fixtures** (`realSkills.test.ts`):
  - Re-baselined against bundled framework v0.18.1 and published example skills.
  - Skills now expected at `skills/<name>/` (canonical publishing location for `gh skill install`).
- **Pinned canopy version: `0.18.1`** in `.canopy-version` and `package.json#canopyVersion`.
- **README and CLAUDE.md** updated:
  - `.agents/skills/` references throughout.
  - `compatibility` column added to the Frontmatter completion table.
  - Language ID file-pattern table lists canonical and legacy patterns side-by-side.
- **`docs/DEVELOPMENT.md`** — test coverage map now lists 9 files (added `installMethodPicks.test.ts`, `availability.test.ts`, `resourceParser.test.ts`).
- **Marketplace tags trimmed** from 19 keywords to 7 (`canopy`, `claude-code`, `copilot`, `agentskills`, `skills`, `declarative`, `vscode-extension`). Drops generic terms (`ai`, `automation`, `framework`, `llm`, `workflow`, `prompt-engineering`) and prefix duplicates (`claude-cli`, `claude-skills`, `copilot-chat`, `copilot-cli`); keeps one per concept.

### Security / supply chain

- **`.github/CODEOWNERS`** added — default reviewer for the repo.
- **Release pipeline produces SLSA build provenance.** Every `v*` tag now generates a Sigstore-signed provenance attestation via `actions/attest-build-provenance@v2` over the packaged `.vsix`. Verify with `gh attestation verify <vsix> --owner kostiantyn-matsebora`.
- **Tags are SSH-signed** — same key already registered as a Signing Key on GitHub. Verify with `git verify-tag vX.Y.Z`.
- **Release notes** now include a verification footer with both commands inline.

### Notes

- **Backward-compatible.** Legacy flat-layout skills (category dirs at the skill root: `schemas/`, `templates/`, `commands/`, etc.) continue to highlight, validate, and complete correctly. Diagnostics flag them with a "consider migrating" hint but never error.
- **Activation, who writes the marker block:**
  - **`Install as Agent Skill (gh skill)` command** — writes proactively (so a fresh-checkout-then-edit flow doesn't need an agent invocation first).
  - **canopy-runtime self-write** — safety net on first agent load (covers plugin-marketplace and bare `gh skill install`).

## [0.10.1] — 2026-04-26

### Fixed

- **`Install as Claude Code Plugin` step-by-step wizard** — replaces the fragile auto-run terminal flow (staggered `sendText` into Claude's stdin) with a three-step clipboard wizard. Each slash command is copied to clipboard in turn; a modal prompts the user to paste and confirm before advancing to the next step.

## [0.10.0] — 2026-04-25

### Added

- **Plugin install detection** — workspace commands now recognize projects where Canopy is installed as a Claude Code plugin (no skill files on disk). Detection falls back to the `<!-- canopy-runtime-begin -->` marker block in `CLAUDE.md` written by `/canopy:canopy activate`. `InstallKind` (`'file' | 'plugin'`) is carried through the full resolution chain.

### Fixed

- **Plugin op invocation** — commands now send `/canopy:canopy <request>` and `/canopy:canopy-debug <skill>` when Canopy is plugin-installed, instead of the bare `/canopy` / `/canopy-debug` forms that only work for file-based installs.
- **Outdated "no project found" error** — message no longer references the removed "Add as copy" / "Add as submodule" commands; now directs to `Canopy Install: Install…`.

## [0.9.2] — 2026-04-25

### Added

- **`SECURITY.md`** — vulnerability reporting policy via private GitHub Security Advisories, with scope notes (extension + workflows in scope; framework + VS Code/Microsoft infra deferred upstream).
- **`CODE_OF_CONDUCT.md`** — adopts Contributor Covenant 2.1 by reference, with a private reporting channel.
- **`.github/dependabot.yml`** — weekly grouped dev-dep updates, weekly direct-dep updates, monthly Actions version bumps.
- **VS Code Marketplace badges in README** — Marketplace Version + Installs badges added alongside the existing GitHub Release / License badges.

### Changed

- **`package.json#keywords` realigned with framework topics** for Marketplace search discoverability — replaces the canopy-only set (`canopy/skill/claude/ai/markdown`) with the full [`claude-canopy`](https://github.com/kostiantyn-matsebora/claude-canopy) topic list (`claude-code`, `claude-skills`, `copilot-chat`, `ai-agent`, `prompt-engineering`, `llm`, `framework`, `workflow`, `automation`, `declarative`, etc.) plus extension-specific tags (`agentskills`, `vscode-extension`).

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
