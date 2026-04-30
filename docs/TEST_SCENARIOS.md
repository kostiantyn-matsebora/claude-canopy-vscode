# VSCode Extension Test Scenarios

Test suites for the `canopy-skills` VSCode extension (`claude-canopy-vscode`). Suites are the parallelization unit — every suite is fully isolated and may run concurrently with any other suite. Scenarios within a suite generally parallelize too (vitest runs them in parallel by default); exceptions are flagged.

This document covers the extension only. For framework-side tests (install scripts, marker-block parity, autonomous-agent E2E, etc.), see [`claude-canopy/docs/TEST_SCENARIOS.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/TEST_SCENARIOS.md).

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
- **Expected:** all tests pass (current baseline: **323/323** across 32 test files).
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
- **Steps:** run `python <claude-canopy>/install-test/check_parity.py` (the canopy framework owns the script; the extension's `MARKER_BLOCK` constant is one of the four sources it compares).
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
C2 (vitest full)         ─┤── C3, C4, and C8 are subsets of C2; run alone for fast feedback
C3 (compat diagnostics)  ─┤   or as part of C2 for the full suite.
C4 (real-skills)         ─┤
C5 (marker parity)       ─┤── all suites parallelize (no shared state)
C8 (per-command)         ─┤
C6 (manual smoke) *      ─┤
C7 (publish gate) **     ─┘

* C6 needs an interactive Extension Development Host — manual only.
** C7 runs once per release tag.
```

CI runs C1 + C2 (which transitively covers C3 + C4 + C8) + C5 on every push to a feature branch and every PR. C6 is a pre-PR sanity check by the author. C7 gates the marketplace publish step in `release.yml`.
