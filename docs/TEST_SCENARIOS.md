# VSCode Extension Test Scenarios

Test suites for the `canopy-skills` VSCode extension (`claude-canopy-vscode`). Suites are the parallelization unit — every suite is fully isolated and may run concurrently with any other suite. Scenarios within a suite generally parallelize too (vitest runs them in parallel by default); exceptions are flagged.

This document covers the extension only. For framework-side tests (install scripts, marker-block parity, autonomous-agent E2E, etc.), see [`claude-canopy/docs/TEST_SCENARIOS.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/TEST_SCENARIOS.md).

**Tracks canopy v0.21.0** — sliced primitive spec (`core` / `interaction` / `control-flow` / `parallel` / `subagent` / `explore` / `verify`), per-skill `metadata.canopy-features` manifest, slim 5-line marker block.

## Conventions

- **Result format** — each scenario lists Steps, Expected, Failure modes. Pass = all Expected hold; any drift in Failure modes = fail.
- **Tracked canopy version** — pinned in `.canopy-version` and `package.json#canopyVersion`. Tests must pass against the canopy framework version pinned there.

---

## Suite C1 — TypeScript compile

**Validates:** the extension source compiles cleanly under the configured `tsconfig.json`.
**Parallelizable:** independent of all other suites.
**Prereqs:** Node, `npm install` completed.

### C1.1 — `npm run compile`
- **Steps:** `npm run compile` (runs `tsc -p ./`).
- **Expected:** clean compile, exit 0, no diagnostics on stderr.
- **Failure modes:** any TypeScript error (broken imports, missing types after a vscode-API bump, parser drift after a canopy framework change).

---

## Suite C2 — Vitest unit tests

**Validates:** all unit tests pass under vitest.
**Parallelizable:** vitest runs test files in parallel by default. Run other suites concurrently — no shared state.
**Prereqs:** `npm install` completed.

### C2.1 — Full vitest run
- **Steps:** `npm test` (runs `vitest run`).
- **Expected:** all tests pass (current baseline: **371/371** across 32 test files).
- **Helper-level test files** (each is internally a suite of `describe` blocks):
  - `src/test/canopyDocument.test.ts` — frontmatter parsing, tree node extraction, Read-ref discovery
  - `src/test/diagnosticsProvider.test.ts` — full diagnostic catalog (frontmatter, structure, primitive signatures, ops conformance, compatibility shape)
  - `src/test/opRegistry.test.ts` — op resolution chain (skill-local → consumer → framework primitives)
  - `src/test/realSkills.test.ts` — re-baseline against the bundled framework + example skills
  - `src/test/installCanopy.test.ts` — install helper behavior, marker-block content
  - `src/test/installMethodPicks.test.ts` — install method picker logic (Claude / Copilot / Cross-client / install-script / gh-skill / plugin)
  - `src/test/canopyAgent.test.ts` — agent prompt construction, framework skill detection, project resolution
  - `src/test/availability.test.ts` — tool availability probing (`git`, `gh skill`, `claude`)
  - `src/test/resourceParser.test.ts` — category file parser (constants, policies, schemas)
- **Per-command handler test files** (`src/test/cmd-*.test.ts`) — see Suite C8.

---

## Suite C3 — Compatibility-shape diagnostics

**Validates:** the diagnostics provider correctly flags non-spec `compatibility` shapes per agentskills.io.
**Parallelizable:** subset of C2; runs alone via `vitest run -t 'compatibility'`.
**Prereqs:** `npm install` completed.

Background: per [agentskills.io spec](https://agentskills.io/specification), `compatibility` is a free-text string (max 500 chars). Structured shapes are non-spec and must be flagged + migrated by `/canopy improve`.

### C3.1 — Block-form YAML map (non-spec)
- **Input:**
  ```yaml
  compatibility:
    requires:
      - canopy-runtime
  ```
- **Expected:** Warning "compatibility must be a YAML string" with migration hint.

### C3.2 — Inline-flow map (non-spec)
- **Input:** `compatibility: { requires: [canopy-runtime] }`
- **Expected:** same warning as C3.1.

### C3.3 — String-shape mentioning canopy-runtime (compliant)
- **Input:** `compatibility: Requires the canopy-runtime skill (published at github.com/...)`
- **Expected:** no diagnostic.

### C3.4 — String-shape NOT mentioning canopy-runtime
- **Input:** `compatibility: Requires git, docker, jq.`
- **Expected:** Hint suggesting the field name canopy-runtime as a dependency and point at a locatable source (only on canopy-flavored skills with `## Tree`).

### C3.5 — Missing `compatibility` on `## Tree` skill
- **Input:** SKILL.md with `## Tree` and no `compatibility` field.
- **Expected:** Warning "Canopy-flavored skills (with '## Tree') must declare a 'compatibility' frontmatter field".

### C3.6 — `compatibility` exceeds 500 chars
- **Input:** string-shape value with > 500 characters.
- **Expected:** Warning "exceeds the 500-character limit defined by the agentskills.io spec".

---

## Suite C4 — Real-skills snapshot

**Validates:** the bundled framework skills (`canopy`, `canopy-runtime`, `canopy-debug`) and the published example skills parse cleanly under the extension's parser, and produce zero diagnostic Errors at the current `canopyVersion`.
**Parallelizable:** subset of C2; runs via `vitest run src/test/realSkills.test.ts`.
**Prereqs:** the `realSkills.test.ts` fixtures point at the pinned framework version; bump `.canopy-version` and refresh fixtures together when canopy releases.

### C4.1 — Framework skills parse with no Errors
- **Skills tested:** `canopy/SKILL.md`, `canopy-runtime/SKILL.md`, `canopy-debug/SKILL.md` from the pinned framework.
- **Expected:** no Errors. Warnings/Hints are tolerated only when they describe known migration debt (legacy layout, etc.).

### C4.2 — Example skills parse with no Errors
- **Skills tested:** `add-changelog-entry`, `bump-version`, `generate-readme`, `review-file`, `scaffold-skill` from `claude-canopy-examples`.
- **Expected:** no Errors. Drift here usually indicates a canopy authoring rule changed without re-running `/canopy improve` on the examples.

### C4.3 — Drift detection on canopy version bump
- **Workflow:** when bumping `.canopy-version`, re-run C4 against the new framework. Any new Error/Warning indicates a sync point in `CLAUDE.md → "Keeping in Sync with claude-canopy"` table that needs attention.

---

## Suite C5 — Marker-block parity (extension side)

**Validates:** the `MARKER_BLOCK` constant in `src/commands/installCanopy.ts` is byte-identical with the framework's canonical marker-block content.
**Parallelizable:** static analysis; trivially safe with anything else.
**Prereqs:** local clone of `claude-canopy` at the same canopy version this extension tracks.

### C5.1 — Four-way parity check
- **Steps:** run `python install-test/check_parity.py` from the canopy workspace root (the canopy framework owns the script; the extension's `MARKER_BLOCK` constant is one of the four sources it compares).
- **Expected:** four `OK` lines (`canonical`, `vscode-ts`, `install.sh`, `install.ps1`).
- **Failure modes:** drift between extension `MARKER_BLOCK` and `claude-canopy/skills/canopy-runtime/assets/constants/marker-block.md`. Update the extension constant verbatim from the canonical source and re-run.

### C5.2 — Manual update protocol after a canopy release
When canopy ships a new release that changes the marker block:
1. Pull latest `claude-canopy` and check `skills/canopy-runtime/assets/constants/marker-block.md`.
2. Replace `MARKER_BLOCK` array literal in `src/commands/installCanopy.ts` with the new content (each line as a single-quoted string element; escape inner single quotes).
3. Re-run C5.1 to confirm parity.
4. Bump `.canopy-version` and `package.json#canopyVersion` to the new framework version.

---

## Suite C6 — Manual smoke tests (Extension Development Host)

**Validates:** end-user UX of install commands, completions, hover, diagnostics, and definitions in the running editor.
**Parallelizable:** runs in a single F5 session per developer; not CI-friendly. Manual.
**Prereqs:** open the extension in VS Code, press F5 to launch Extension Development Host.

### C6.1 — Install commands surface
- Open command palette → type `Canopy Install:`.
- **Expected:** four commands visible — "Install... (pick method)", "Install (via install script)", "Install as Agent Skill (gh skill)", "Install as Claude Code Plugin".

### C6.2 — Pick-method flow with Cross-client target
- Run `Canopy Install: Install...`.
- **Expected:** target picker offers Claude Code, GitHub Copilot, Both, **Cross-client** (with `.agents/skills/` description).

### C6.3 — Install via gh skill
- Run `Canopy Install: Install as Agent Skill (gh skill)`.
- **Expected:** if local `gh` < 2.90, the command warns and offers fallback. Otherwise, picks Claude / Copilot / Cross-client and emits the right `gh skill install` command (Cross-client uses `--dir .agents/skills`).

### C6.4 — Completions, hover, definition on a SKILL.md
Open a known SKILL.md (e.g. an example skill), trigger:
- Completions on a tree node start (`SHOW_PLAN`, `ASK`, `IF`, custom op names registered in `references/ops.md`).
- Hover on a frontmatter key (e.g. `compatibility:`) and a primitive (e.g. `IF`).
- Go-to-definition on an `ALL_CAPS` op call (jumps to its definition in `references/ops.md` or `framework-ops.md`).
- **Expected:** all three respond instantly with the documented content.

### C6.5 — New-resource scaffold commands
- Run `Canopy Template: New Skill` from a folder.
- **Expected:** scaffolds a complete skill with spec-compliant frontmatter (free-text `compatibility`, `metadata.argument-hint`, structured safety preamble) and the standard layout (`scripts/`, `references/`, `assets/{templates,constants,schemas,checklists,policies,verify}/`).

### C6.6 — Layout-migration UX (snippets, hover, completion)
Validates the v0.18.0 agentskills.io alignment is reflected in user-visible surfaces.
- Type `skill` in a new `SKILL.md` → snippet expansion contains a `compatibility:` field, a safety preamble mentioning canopy-runtime, `metadata:` block with `argument-hint:` inside, and `VERIFY_EXPECTED << assets/verify/verify-expected.md`.
- Hover `## Agent` heading → docs mention `assets/schemas/explore-schema.json`.
- Hover `VERIFY_EXPECTED` token → signature shows `VERIFY_EXPECTED << assets/verify/<file>.md`.
- Type `read` snippet trigger → "Read resource" dropdown lists agentskills paths first (`assets/schemas`, `assets/templates`, `assets/constants`, `assets/policies`, `assets/verify`, `assets/checklists`, `scripts`, `references`) followed by legacy paths.
- Open command palette → `Canopy Template: New Script File` is visible (was "New Commands File" before v0.18.0 alignment); selecting it writes to `scripts/`.
- Frontmatter highlighting on a SKILL.md → `compatibility:`, `metadata:`, `allowed-tools:`, `license:` keys all rendered as recognized fields (same style as `name:` / `description:`).

---

## Suite C8 — Per-command handler tests

**Validates:** every command id contributed in `package.json#contributes.commands` has a vitest test that exercises its registered handler — input prompts, branching, and the dispatch action it produces (terminal `sendText` / `child_process.exec` / clipboard / file write / info message).
**Parallelizable:** subset of C2; vitest runs all 23 files in parallel. Each file uses inline `vi.spyOn` / property-assignment to extend the shared `vscode` mock (the auto-loaded mock in `src/__mocks__/vscode.ts` is intentionally minimal — see [project_vscode_test_sweep_findings.md] for the lift-into-shared-mock follow-up).
**Prereqs:** `npm install` completed.

Each scenario lists: **Invocation** (what the user-facing flow looks like), **Seed** (mocked state), **Pass criteria** (what the test asserts).

The test pattern was developed via the parallel-subagent E2E sweep on 2026-04-30 (4 batches × ~6 commands; one focused test file per command; per-command `RESULT.json` aggregated by the parent agent).

### Suite layout

23 test files at `src/test/cmd-<slug>.test.ts`, one per command id. Each declares ≥2 `it(...)` cases — a happy path and a cancel/no-op path, plus extras where the handler has additional branches (e.g. `cmd-agent-scaffold.test.ts` has a `validateInput` case for the kebab-case regex).

### Agent-command handlers (11) — `src/commands/canopyAgent.ts`

These dispatch `/canopy <request>` (Claude target via `claude` CLI in a terminal) or `Follow .github/skills/canopy/SKILL.md and <request>` (Copilot target via `vscode.commands.executeCommand('workbench.action.chat.open')`). Plugin installs use the namespaced `/canopy:canopy` form.

#### C8.1 — `canopy.agentCreate`
**Invocation:** `showInputBox(description)` → dispatch. **Pass:** sendText carries `/canopy create a skill that <description>`; cancel = no dispatch.

#### C8.2 — `canopy.agentModify`
**Invocation:** `pickSkill` then `showInputBox(change)` → dispatch. **Pass:** sendText carries `/canopy modify the <skill> skill — <change>`; pickSkill cancel = no dispatch.

#### C8.3 — `canopy.agentScaffold`
**Invocation:** `showInputBox(name, validateInput=kebab-case)` → dispatch. **Pass:** sendText carries `/canopy scaffold a blank skill named <name>`; `validateInput` returns error for non-kebab and undefined for valid; cancel = no dispatch.

#### C8.4 — `canopy.agentConvertToCanopy`
**Invocation:** `pickSkill` → dispatch. **Pass:** sendText carries `/canopy convert the <skill> skill to canopy format`.

#### C8.5 — `canopy.agentValidate`
**Invocation:** `pickSkill` → dispatch. **Pass:** sendText carries `/canopy validate the <skill> skill`.

#### C8.6 — `canopy.agentImprove`
**Invocation:** `pickSkill` → dispatch. **Pass:** sendText carries `/canopy improve the <skill> skill — align with framework rules`.

#### C8.7 — `canopy.agentAdvise`
**Invocation:** `showInputBox(question)` → dispatch. **Pass:** sendText carries `/canopy how to <question>`.

#### C8.8 — `canopy.agentRefactorSkills`
**Invocation:** no input — dispatches a fixed string. **Pass:** sendText carries `/canopy refactor skills — extract common ops and resources`; no-project (no canopy-runtime marker) = no dispatch.

#### C8.9 — `canopy.agentConvertToRegular`
**Invocation:** `pickSkill` → dispatch. **Pass:** sendText carries `/canopy convert the <skill> skill back to a regular plain skill`.

#### C8.10 — `canopy.agentHelp`
**Invocation:** no input — dispatches a fixed string. **Pass:** sendText carries `/canopy help — list all operations`; no-project = no dispatch.

#### C8.11 — `canopy.agentDebug`
**Invocation:** `pickSkill` → dispatch via `buildClaudeCliDebugCommand`. **Pass:** sendText carries `/canopy-debug <skill>` (NOT `/canopy ...`).

### Install-command handlers (4) — `src/commands/installCanopy.ts`

Dispatch surfaces vary by handler — see findings memo for the discrepancy with the documented "all use terminal" model.

#### C8.12 — `canopy.install`
**Invocation:** `showQuickPick` over install methods (install-script / gh-skill / plugin) → dispatches to the chosen method's handler (currently a direct function call; see findings #2).
**Pass:** picking gh-skill advances to the gh-install-location picker; cancel = no further pickers, no dispatch.

#### C8.13 — `canopy.installByCopy`
**Invocation:** `pickWorkspaceFolder`, `pickTarget`, `pickVersion` → runs install script via `child_process.exec` (NOT terminal.sendText).
**Pass:** captured exec command contains `install.sh` (Unix) or `install.ps1` (Windows) with the chosen target flag; pickTarget cancel = no exec.

#### C8.14 — `canopy.installAsAgentSkill`
**Invocation:** picks workspace + agent (`claude-code` or `github-copilot`) + skills + version → runs `gh skill install ...` via `child_process.exec`.
**Pass:** captured exec command contains `gh skill install`, `kostiantyn-matsebora/claude-canopy`, the picked skill, and `--agent <agent>`. No `--pin` when version is empty. First-picker cancel = no exec.

#### C8.15 — `canopy.installAsPlugin`
**Invocation:** always routes through `vscode.env.clipboard.writeText` (no terminal branch — see findings #2).
**Pass:** clipboard receives all 3 slash commands — `/plugin marketplace add ...`, `/plugin install canopy@claude-canopy`, `/canopy:canopy activate`. Skill-picker cancel = no clipboard write.

### New-resource-command handlers (7) — `src/commands/newResource.ts`

Each resolves the active skill dir (active editor or workspace pick) and writes a templated file. Pass criteria assert the written path and key content tokens.

#### C8.16 — `canopy.newSkill`
**Invocation:** `showInputBox(skillName)` → writes 2 files. **Pass:** writeFileSync called with paths ending `<name>/SKILL.md` and `<name>/references/ops.md`, both contents containing the skill name.

#### C8.17 — `canopy.newVerifyFile`
**Invocation:** `showInputBox(name)` → writes verify file. **Pass:** writeFileSync called with path ending `assets/verify/<name>.md`; content has checklist scaffold (`- [ ]`, `## Changes applied`, `## No regressions`).

#### C8.18 — `canopy.newTemplate`
**Invocation:** `showInputBox(name)` → `showQuickPick(.md|.yaml)` → writes template. **Pass:** writeFileSync called with path ending `assets/templates/<name>.<ext>`.

#### C8.19 — `canopy.newConstantsFile`
**Invocation:** `showInputBox(name)` → writes constants file. **Pass:** writeFileSync called with path ending `assets/constants/<name>.md`; content contains `# <name>`, the table header, and the `EXAMPLE` token.

#### C8.20 — `canopy.newPolicyFile`
**Invocation:** `showInputBox(name)` → writes policy file. **Pass:** writeFileSync called with path ending `assets/policies/<name>.md`; content contains `# <name>`, `## Rules`, `## Constraints`.

#### C8.21 — `canopy.newCommandsFile`
**Invocation:** `showInputBox(name)` → `showQuickPick(.sh|.ps1)` → writes script. **Pass:** writeFileSync called with path ending `scripts/<name>.<ext>`.

#### C8.22 — `canopy.newSchema`
**Invocation:** `showQuickPick(type)` first; if `custom`, `showInputBox(name)` → writes JSON file. **Pass:** writeFileSync called with path ending `assets/schemas/<name>.json` (NOT `.md` — see findings #3); type-picker cancel = no input prompt, no write.

### Misc (1) — `src/extension.ts`

#### C8.23 — `canopy.showVersion`
**Invocation:** registered inline in `activate()` (no exported handler) — reads `context.extension.packageJSON.{version, canopyVersion}` and shows an info message.
**Pattern:** the test stubs `vscode.commands.registerCommand` to capture the inline handler, then invokes it with a fake `ExtensionContext`.
**Pass:** message exactly equals `Canopy Skills v<version> — Canopy framework v<canopyVersion>`; missing `canopyVersion` falls back to `vunknown`.

---

## Suite C9 — Layout-migration diagnostics

**Validates:** the diagnostics provider, parser, and registries recognize both the agentskills.io `assets/<sub>/` standard layout AND the legacy flat layout, without false positives.
**Parallelizable:** subset of C2; runs alone via `vitest run -t 'agentskills'` or as part of the full `npm test`.
**Prereqs:** `npm install` completed.

Background: canopy v0.18.0 adopted the agentskills.io standard layout (`scripts/`, `references/`, `assets/{templates,constants,schemas,checklists,policies,verify}/`). The extension must accept both layouts during the migration window — legacy skills continue to validate cleanly, agentskills skills produce no false positives. See `claude-canopy/skills/canopy/assets/constants/category-dirs.md` for the canonical legacy ↔ standard mapping.

### C9.1 — `assets/<sub>/` Read-ref category extraction
- **Input:** `` Read `assets/policies/foo.md` for X `` (and the five other agentskills sub-categories).
- **Expected:** category resolves to two-segment `assets/policies/`, not single-segment `assets/`. No "Unknown resource category" diagnostic.
- **Failure mode:** parser collapsing every path to its first slash → all real canopy v0.18.0+ skills get flagged with "Unknown resource category 'assets/'" on every Read line.

### C9.2 — `VERIFY_EXPECTED` accepts both prefixes
- **Inputs:**
  - `* VERIFY_EXPECTED << verify/check.md` (legacy flat layout)
  - `* VERIFY_EXPECTED << assets/verify/check.md` (agentskills layout)
- **Expected:** no path-prefix warning on either input.
- **Failure mode:** hardcoded `startsWith('verify/')` rejecting the agentskills form (which is what canopy `/improve` migrates to).

### C9.3 — Plain ``` fence in `## Tree` is allowed (box-drawing)
- **Input:** Tree section wrapped in a plain ``` fence containing a box-drawing tree (`├──`, `└──`, etc.) — the canonical box-drawing form per `docs/FRAMEWORK.md`.
- **Expected:** no "should not contain inline code blocks" warning.
- **Failure mode:** every fenced block in `## Tree` flagged regardless of content → users can't use the box-drawing syntax documented in the framework spec.

### C9.4 — Fenced language code blocks in `## Tree` still warn
- **Input:** Tree section containing ` ```yaml ... ``` ` or ` ```json ... ``` ` block (structural content that belongs in a category resource file).
- **Expected:** Warning that names the language tag (e.g. "should not contain a fenced 'yaml' code block").
- **Failure mode:** allowing structured content in SKILL.md Tree (violates SKILL.md constraints documented in `claude-canopy/CLAUDE.md` "SKILL.md Constraints").

---

## Suite C10 — `metadata.canopy-features` manifest drift diagnostics (v0.21.0+)

**Validates:** the diagnostic provider surfaces the five drift cases for the per-skill slice manifest. vscode-side severity is `Error` for the four "wrong" cases; `Warning` for the "absent" case (back-compat). Framework `/canopy validate` emits `Warning` on all five — the extension is intentionally stricter at author-time.
**Parallelizable:** subset of C2; runs alone via `vitest run -t 'canopy-features'`.
**Prereqs:** `npm install` completed; framework v0.21.0 pinned.

Background: v0.21.0 introduced the optional `metadata.canopy-features: [...]` manifest declaring which primitive families a skill uses (`interaction`, `control-flow`, `parallel`, `subagent`, `explore`, `verify`). The runtime lazy-loads only the named slices. `core` is always loaded and must NOT be declared.

### C10.1 — Manifest absent on a `## Tree` skill (back-compat)
- **Input:** SKILL.md with `## Tree` and `metadata:` block but no `canopy-features` field.
- **Expected:** **Warning** at the frontmatter, message includes "missing `metadata.canopy-features` manifest". No Error. Skill is still recognized as canopy-flavored.
- **Failure modes:** Error severity (would break v0.20.x skills that haven't been retrofitted); silent acceptance (no nudge for new authors to add the manifest).

### C10.2 — Manifest declares slice the tree doesn't use
- **Input:** `canopy-features: [interaction, parallel]` but no `PARALLEL` node anywhere in the tree.
- **Expected:** **Error** anchored at the `canopy-features` line, message includes "declares 'parallel' but the skill's tree does not use it".
- **Failure modes:** false positive on a skill whose manifest correctly matches; no diagnostic when drift is real.

### C10.3 — Tree uses slice the manifest omits
- **Input:** `canopy-features: [interaction]` but tree contains `* **OP** << x >> y` (subagent dispatch).
- **Expected:** **Error**, message includes "Tree uses 'subagent' but `metadata.canopy-features` does not declare it".
- **Failure modes:** missed when the used slice is an indirect signal (subagent dispatch via bold call-site, `## Agent` declaring explore).

### C10.4 — Manifest lists `core`
- **Input:** `canopy-features: [core, interaction]`.
- **Expected:** **Error**, message includes "`metadata.canopy-features` lists 'core'" and "`core` is always loaded — remove it from the manifest".
- **Failure modes:** no diagnostic (lets `core` slip through and pollute the drift signal).

### C10.5 — Manifest lists unknown value
- **Input:** `canopy-features: [interaction, dispatch-magic]`.
- **Expected:** **Error**, message includes "unknown value 'dispatch-magic'" and lists the 6 valid slice names.
- **Failure modes:** silent acceptance of typos like `parralel` or `controlflow`.

### C10.6 — Hover on `metadata.canopy-features` key
- **Steps:** Hover the `canopy-features` key inside a `metadata:` block.
- **Expected:** Hover popup explains the field, lists the 6 valid values, notes that `core` is always loaded, and mentions the drift diagnostics.
- **Failure modes:** no hover (regressed when the metadata-block hover handler is reordered).

### C10.7 — Completion inside `canopy-features: [...]`
- **Steps:** Inside the array literal, trigger completion (Ctrl+Space).
- **Expected:** Six completion items — `interaction`, `control-flow`, `parallel`, `subagent`, `explore`, `verify`. Already-listed values are filtered out (no duplicate suggestions).
- **Failure modes:** suggestions outside the array, or `core` listed.

---

## Suite C11 — Subagent dispatch surface (v0.20.0+)

**Validates:** the v0.20.0 subagent dispatch model is surfaced uniformly across parser, diagnostics, hover, definition, snippets, and grammar.
**Parallelizable:** subset of C2; some F5-only sub-scenarios noted.
**Prereqs:** `npm install` completed.

Background: v0.20.0 introduced per-op marker blockquotes (`> **Subagent.** Output contract: ...`) at the op definition site, plus bold-wrapped op names (`* **OP** << ... >> ...`) at the tree call site. The extension recognizes both forms and surfaces them via diagnostics, snippets, and hover.

### C11.1 — Subagent marker recognition at op definition
- **Input:** ops.md entry with a `> **Subagent.** Output contract: \`assets/schemas/foo-output.json\`.` line directly under the heading.
- **Expected:** parser sets `isSubagent: true` and captures `outputContract` on the op definition. Hover on a call site shows ", subagent dispatch".
- **Failure modes:** marker missed (parser regex too strict on whitespace / wrap); contract path not captured.

### C11.2 — Bold call-site detection in tree
- **Input:** `* **MY_OP** << input >> output` inside `## Tree`.
- **Expected:** parser sets `subagentCall: true` on the tree node. Diagnostics flag it as Error if the resolved op definition lacks a subagent marker.
- **Failure modes:** plain `* MY_OP << ...` flagged as subagent (regex too loose); bold call-site missed (regex too strict).

### C11.3 — Snippet expansion
- **Steps:** Type `op-subagent` then `call-subagent` in an empty SKILL.md.
- **Expected:** `op-subagent` expands to a heading + `> **Subagent.** Output contract: ...` blockquote + tree body. `call-subagent` expands to `* **OP_NAME** << input >> output`.
- **Failure modes:** snippet references the old `## Agents` section (removed in v0.20.0).

### C11.4 — Definition jump on contract path
- **Steps:** F12 / Ctrl+Click on the `assets/schemas/foo-output.json` path in a marker blockquote.
- **Expected:** opens the schema file (resolved relative to the skill dir).
- **Failure modes:** "no definition" (path resolution skipping the marker blockquote context).

### C11.5 — Grammar coverage (manual, F5)
- **Steps:** Open a SKILL.md containing both forms in an Extension Development Host.
- **Expected:** the marker blockquote `> **Subagent.**` and the call-site `**OP**` render with the dedicated subagent scopes (`subagent-call`, `subagent-marker`).
- **Failure modes:** marker / call-site falls back to default markdown highlighting.

---

## Suite C12 — `PARALLEL` block highlighting (v0.19.0+)

**Validates:** the `PARALLEL` primitive is recognized as a control-flow op by parser, diagnostics, completion, hover, and grammar.
**Parallelizable:** subset of C2.
**Prereqs:** `npm install` completed.

### C12.1 — Parser recognition
- **Input:** `* PARALLEL` followed by N `* op-call >> ctx_X` children.
- **Expected:** parser tags the node as primitive `PARALLEL`. `computeUsedFeatures` returns `parallel` in the result set.
- **Failure modes:** PARALLEL treated as a custom op (manifest-drift diagnostics then misfire).

### C12.2 — Hover surfaces `Slice: parallel`
- **Steps:** Hover the `PARALLEL` token.
- **Expected:** hover popup includes `Slice: parallel` line under the signature.
- **Failure modes:** no slice line (PRIMITIVE_DOCS entry missing the `slice` field).

### C12.3 — Completion in tree node start position
- **Steps:** On a fresh tree node line, trigger completion.
- **Expected:** `PARALLEL` appears in the suggestions list with detail "control-flow primitive".
- **Failure modes:** absent from completions; or duplicated as both keyword and function.

### C12.4 — Grammar scope (manual, F5)
- **Steps:** Open a SKILL.md with `PARALLEL` in an Extension Development Host.
- **Expected:** `PARALLEL` renders with the `primitive-control` (or equivalent) scope colorization.
- **Failure modes:** falls back to default text color.

---

## Suite C7 — Marketplace publish gate (release-only)

**Validates:** the packaged `.vsix` installs cleanly into VS Code from disk; metadata renders correctly on the marketplace.
**Parallelizable:** runs once per release. Manual.
**Prereqs:** `@vscode/vsce` installed; clean working tree at the release tag.

### C7.1 — Local package install
- **Steps:** `npm run package` → `code --install-extension canopy-skills-X.Y.Z.vsix`.
- **Expected:** install succeeds; extension activates without error in a fresh VS Code window.

### C7.2 — Marketplace metadata preview
- **Steps:** Inspect the generated `.vsix`'s `package.json` and `README.md` rendering.
- **Expected:** badges resolve (`vsmarketplacebadges.dev`); install count + rating placeholders visible; categories and keywords match `package.json`.

---

## Parallelization graph

```
C1 (compile)             ─┐
C2 (vitest full)         ─┤── C3, C4, C8, C9, C10, C11, C12 are subsets of C2;
C3 (compat diagnostics)  ─┤   run alone for fast feedback or via the full C2.
C4 (real-skills)         ─┤
C5 (marker parity)       ─┤── all suites parallelize (no shared state)
C8 (per-command)         ─┤
C9 (layout migration)    ─┤
C10 (manifest drift)     ─┤── v0.21.0+
C11 (subagent dispatch)  ─┤── v0.20.0+
C12 (PARALLEL)           ─┤── v0.19.0+
C6 (manual smoke) *      ─┤
C7 (publish gate) **     ─┘

* C6 needs an interactive Extension Development Host — manual only.
** C7 runs once per release tag.
```

CI runs C1 + C2 (which transitively covers C3 + C4 + C8–C12) + C5 on every push to a feature branch and every PR. C6 is a pre-PR sanity check by the author. C7 gates the marketplace publish step in `release.yml`.
