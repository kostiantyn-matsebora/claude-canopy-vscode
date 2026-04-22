<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to Canopy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.16.0] — 2026-04-22

### Added

- `install.sh` / `install.ps1` and `setup.sh` / `setup.ps1` now accept `--target claude|copilot` (`-Target` on PowerShell) to wire either `.claude/` or `.github/` on a fresh install. Previously the scripts were Claude-only despite the framework's dual-platform compatibility rule.
- Copilot target: canopy source is placed at `.github/canopy/`; skills and agents are linked under `.github/skills/` and `.github/agents/`; a marker-delimited `## Canopy Skill Resources` section is appended to `.github/copilot-instructions.md` (Copilot has no glob-based ambient rules, so the Claude-flavored `rules/skill-resources.md` isn't created).
- README Quick Start: dedicated Copilot invocation line for each installer.

### Changed

- Setup scripts now emit `$BASE`-aware paths in both `shared/ops.md` stubs and the "Next steps" output, so Copilot users see `.github/...` paths instead of `.claude/...`.

## [0.15.0] — 2026-04-21

### Added

- `agents/canopy/policies/authoring-rules.md` — consolidated policy file merging five prior files (`skill-structure-rules.md`, `writing-rules.md`, `op-naming-rules.md`, `subagent-rules.md`, `debug-rules.md`). VALIDATE now loads one policy file instead of four.
- `agents/canopy/constants/validate-checks.md` — extracted the Error/Warning/Optimization check catalog out of `ops/validate.md` (was ~30 inline lines). `validate.md` shrinks from 61 → 15 lines.
- `agents/canopy/constants/apply-block-protocol.md` — single definition of the fenced `apply` block format and re-invocation rule. 7 ops (CREATE, MODIFY, IMPROVE, SCAFFOLD, REFACTOR_SKILLS, CONVERT_TO_CANOPY, CONVERT_TO_REGULAR) now reference the protocol instead of each repeating ~10 lines of boilerplate.
- `agents/canopy/constants/platform-detection.md` — `.claude/` → `claude`, `.github/` → `copilot` mapping; previously inlined in `agents/canopy.md` `## Agent` body.
- `agents/canopy/constants/target-platform-triggers.md` — trigger-phrase lookup ("for copilot", "as claude", etc.); previously inlined.
- `agents/canopy/ops/fetch-dispatch-context.md` — tree-form op implementing the canopy agent's dispatch context resolution (intent classification, platform detection, target-platform resolution, skill extraction, extra context).
- `agents/canopy/policies/authoring-rules.md` — new "`## Agent` body shape" section with three canonical shapes (A: minimal / B: sub-task bullets / C: op reference), must-not list, and multi-concern MUST rule.
- `agents/canopy/constants/validate-checks.md` — two new Errors (inline mapping/enumeration in `## Agent`, inline quoted examples in `## Agent`) and two new Warnings (schema-field lists in `## Agent`, multi-concern prose in `## Agent`).

### Changed

- `agents/canopy.md` — `## Agent` body reduced from ~6-line prose paragraph (inlining mapping, examples, and schema-field list) to a single shape (C) line: `**explore** — execute FETCH_DISPATCH_CONTEXT. Output contract: schemas/dispatch-schema.json.`
- `agents/canopy/ops/validate.md` — reads `policies/authoring-rules.md` (single file) instead of four separate policy files; reads `constants/validate-checks.md` for the check catalog.
- `agents/canopy/ops/create.md`, `convert-to-canopy.md` — references updated from `skill-structure-rules.md` / `writing-rules.md` to `authoring-rules.md`.
- `agents/canopy/ops/create.md`, `modify.md`, `improve.md`, `scaffold.md`, `refactor-skills.md`, `convert-to-canopy.md`, `convert-to-regular.md` — apply-block boilerplate replaced with single-line reference to `constants/apply-block-protocol.md`.
- `agents/canopy/constants/operations-dispatch.md` — absolute `.github/agents/canopy/ops/…` paths replaced with paths relative to the agent directory (`ops/…`). Fixes Claude Code dispatch — previously only worked on Copilot.
- `agents/canopy/policies/authoring-rules.md` "Subagent contract" — runtime fallback behavior removed (was duplicated with `runtimes/copilot.md`); replaced with cross-reference to runtime specs.
- `agents/canopy/schemas/explore-schema.json` — example `existing_resources` entry updated from `policies/writing-rules.md` to `policies/authoring-rules.md`.
- `runtimes/claude.md`, `runtimes/copilot.md` — added op-resolution rule for `## Agent` shape (C): `**explore** — execute NAMED_OP` is resolved via the standard op lookup chain and the op body is injected as the subagent's task (or inlined on Copilot).
- `agents/canopy/ops/scaffold.md` — scaffolded `skill.md` template now includes an optional commented-out `## Agent` stanza with pointer to `policies/authoring-rules.md` for shape selection.
- `docs/AUTHORING.md` — trimmed from 262 → ~170 lines by replacing duplicated tables/sections (notation, framework primitives, category directories, op lookup order) with links to the corresponding FRAMEWORK.md anchors; `## Agent` subsection rewritten with three canonical shapes.
- `docs/FRAMEWORK.md` — Skill Anatomy section cross-references AUTHORING.md's three `## Agent` shapes; directory-layout comment updated to reflect new policy filenames.
- `docs/CHEATSHEET.md` — added `## Agent body shapes` quick-reference table.
- `docs/CONTRIBUTING.md` — sync-required file list references `authoring-rules.md` instead of the deleted `optimization-rules.md`.
- `CLAUDE.md` — `agents/canopy/policies/` description updated to list current policy filenames.
- `skills/canopy-help/SKILL.md` — added platform detection branch; previously hardcoded only `.github/` paths so was Copilot-only.
- `setup.sh`, `setup.ps1` — generated `skill-resources.md` now includes `checklists/` row in the category table (was missing).
- VS Code extension `src/commands/setupCanopy.ts` — `SKILL_RESOURCES_COPY` and `SKILL_RESOURCES_COPILOT` templates now include `checklists/` in the category table and `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH` in the primitives list.

### Removed

- `agents/canopy/policies/skill-structure-rules.md`, `writing-rules.md`, `op-naming-rules.md`, `subagent-rules.md`, `debug-rules.md` — consolidated into `authoring-rules.md`.
- `agents/canopy/policies/optimization-rules.md` — was a dead index file pointing at the files now merged into `authoring-rules.md`.

---

## [0.14.0] — 2026-04-21

### Changed

- `agents/canopy/ops/validate.md` — two new Errors added: inline fixed text in any tree node (including `Report:`, natural language steps, op descriptions) must be extracted to `constants/`; inline parameterised text with `<token>` slots must be extracted to `templates/`; procedural note added: for content-class rules, iterate every tree node in order and apply each check explicitly — do not rely on a holistic scan

---

## [0.13.0] — 2026-04-20

### Changed

- `agents/canopy/ops/validate.md` — added scope line: all checks apply to tree nodes in both `skill.md` and `ops.md` equally; new Error for complex inline command invocations (must extract to `commands/`); new Warning for long prose nodes (must extract to named op)
- `agents/canopy/ops/improve.md` — step 9 changed to iterative: repeat VALIDATE + fix loop until no Errors or Warnings remain (previously stopped after one pass, leaving residual violations)
- `agents/canopy/ops/create.md` — `ops.md` quality spec added: nodes must comply with same writing-rules and skill-structure-rules as `skill.md`; footer added reinforcing short nodes and commands-extraction requirement
- `agents/canopy/policies/writing-rules.md` — two new sections: "Tree nodes → ops" (long prose must be extracted); "Static and parameterised content → constants or templates" (applies to all node types)
- `agents/canopy/policies/skill-structure-rules.md` — added to must-NOT-contain list: complex inline command invocations must be extracted to `commands/` scripts

---

## [0.12.0] — 2026-04-20

### Added

- `skills/shared/framework/ops.md` — new `FOR_EACH << item in collection` primitive for iterating over collections; body executes once per element; empty collection skips body entirely; `BREAK` inside exits the loop early; `BREAK` outside a loop exits the current op (dual role clarified)

### Changed

- `docs/FRAMEWORK.md` — added `FOR_EACH` to node types table, Control Flow Primitives section, and Op Registries table; primitives sentence updated
- `docs/AUTHORING.md` — added `FOR_EACH` and updated `BREAK` in Framework Primitives table
- `agents/canopy/constants/control-flow-notation.md` — added migration entries for `FOR_EACH` (replace prose loops and numbered-step-per-item patterns)
- `agents/canopy/ops/validate.md` — `FOR_EACH` added to error check for framework primitives defined in skill/project ops
- `agents/canopy.md` — primitives list updated
- `skills/canopy-debug/ops.md` — `FOR_EACH` added to never-simulated primitives list
- `rules/skill-resources.md`, `setup.sh`, `setup.ps1`, `CLAUDE.md` — primitives lists updated

---

## [0.11.0] — 2026-04-20

### Added

- `skills/shared/framework/ops.md` — three new control-flow primitives: `SWITCH << expression`, `CASE << value`, `DEFAULT`; `SWITCH` evaluates an expression once and executes the first matching `CASE`; `DEFAULT` fires when no `CASE` matched; use in place of long `IF/ELSE_IF` chains that branch on a single value

### Changed

- `docs/FRAMEWORK.md` — added `SWITCH/CASE/DEFAULT` to Control Flow Primitives section and Op Registries table; updated primitives list in Op Lookup Order
- `docs/AUTHORING.md` — added `SWITCH`, `CASE`, `DEFAULT` to Framework Primitives table
- `agents/canopy/constants/control-flow-notation.md` — added migration entries for `SWITCH/CASE` (replace repeated `ELSE_IF` chains matching one value)
- `agents/canopy/ops/validate.md` — `SWITCH`, `CASE`, `DEFAULT` added to error check for framework primitives defined in skill/project ops
- `agents/canopy.md` — primitives list updated
- `skills/canopy-debug/ops.md` — `SWITCH`, `CASE`, `DEFAULT` added to never-simulated primitives list
- `rules/skill-resources.md`, `setup.sh`, `setup.ps1`, `CLAUDE.md` — primitives lists updated

---

## [0.10.0] — 2026-04-20

### Added

- `skills/canopy/skill.md` — new bundled `canopy` skill; detects active platform and delegates to `.claude/agents/canopy.md` or `.github/agents/canopy.md`; enables `/canopy <request>` as the primary invocation shorthand on Claude Code
- `agents/canopy/policies/platform-targeting.md` — platform targeting policy for write ops (CREATE, SCAFFOLD, CONVERT_TO_CANOPY): maps execution platform and explicit user target to the correct skills base path; enforces no hardcoded `.claude/` or `.github/` paths in generated skill content

### Changed

- `agents/canopy.md` — `dispatch-schema.json` explore output extended with `available_platforms` (all detected platform dirs) and `explicit_target_platform` (from user input or null); added rule: always load platform runtime spec before executing any op procedure
- `agents/canopy/schemas/dispatch-schema.json` — added `available_platforms` (array) and `explicit_target_platform` (string or null) fields to the dispatch output contract
- `agents/canopy/ops/create.md`, `scaffold.md`, `convert-to-canopy.md` — platform-aware skill path resolution via `policies/platform-targeting.md`
- `agents/canopy/ops/validate.md` — added cross-platform content check: flags hardcoded `.claude/` or `.github/` paths in skill files
- `agents/canopy/policies/skill-structure-rules.md` — added cross-platform content rule: `skill.md` must not contain hardcoded platform paths
- `agents/canopy/policies/subagent-rules.md` — documented platform-specific subagent execution: native Explore subagent on Claude Code; inline sequential file-reading fallback on Copilot
- `agents/canopy/verify/create-expected.md`, `scaffold-expected.md` — verify target-platform path rather than hardcoded `.claude/` path
- `runtimes/claude.md` — invocation updated to `/canopy <request>` via the bundled `canopy` skill
- `docs/README.md` — invocation section rewritten: `/canopy <request>` as primary form for Claude Code; `Follow .github/agents/canopy.md and <request>` for Copilot; operations table updated with concrete `/canopy` examples
- `CLAUDE.md` — Contributing Rules: added documentation verification requirement — every framework change must be verified against `runtimes/`, `AUTHORING.md` for staleness before the work is considered done

---

## [0.9.0] — 2026-04-19

### Added

- `runtimes/claude.md` — Claude Code runtime spec: base paths (`.claude/`), native explore subagent execution, ambient rules via globs, agent and skill invocation forms
- `runtimes/copilot.md` — GitHub Copilot runtime spec: base paths (`.github/`), inline sequential file-reading fallback when native subagent is unavailable, `copilot-instructions.md` rules wiring, explicit agent invocation form
- `agents/canopy/schemas/dispatch-schema.json` — output contract for the canopy agent's own intent-classification subagent; fields: `operation`, `platform` (`claude` | `copilot`), `target_skill`, `extra_context`

### Changed

- `agents/canopy.md` — restructured from free-form prose to Canopy skill format (frontmatter + `## Agent` + `## Tree` + `## Rules` + `## Response:`); `## Agent` explore subagent now classifies intent **and** detects platform; `## Tree` replaces LLM-inferred dispatch with an explicit `IF/ELSE_IF` chain over `context.operation` — deterministic routing to one of 10 ops; falls back to `ASK` when intent is ambiguous
- `docs/README.md` — added "Skills that run on Claude Code and GitHub Copilot" to Why Canopy; updated How It Works to describe platform-aware execution and self-hosting agent design; updated Under the Hood diagram with Stage 2 (detect platform + load runtime), Stage 3 (explore with native vs inline fallback), and runtime specs legend
- `docs/FRAMEWORK.md` — added Runtime Model section (interpreter model rationale, feature delta table, runtime spec file list); updated directory layout to show `runtimes/` and both schema files
- `CLAUDE.md` — updated Key Files to document `runtimes/`, `dispatch-schema.json`, and the new canopy agent structure

---

## [0.8.1] — 2026-04-16

### Changed

- `agents/canopy/ops/improve.md`, `modify.md`, `refactor-skills.md`, `convert-to-canopy.md`, `create.md`, `scaffold.md`, `convert-to-regular.md` — all confirmation-pause ops now emit a fenced `apply` block (op name, skill name, per-file change list) immediately before asking "Proceed?"; if re-invoked after the block is visible in context the agent skips analysis and applies directly, preventing plan context loss across invocations
- `agents/canopy/ops/help.md` — corrected Claude Code CLI invocation section: `/canopy` invokes a skill, not the agent; natural language requests auto-apply the agent from `.claude/agents/canopy.md`; explicit form documented as `Follow .claude/agents/canopy.md and <request>`

---

## [0.8.0] — 2026-04-16

### Added

- `agents/canopy/ops/` — per-operation procedure files extracted from `agents/canopy.md`: `create.md`, `modify.md`, `scaffold.md`, `convert-to-canopy.md`, `validate.md`, `convert-to-regular.md`, `improve.md`, `advise.md`, `refactor-skills.md`, `help.md`
- `agents/canopy/constants/` — extracted lookup tables: `category-dirs.md`, `control-flow-notation.md`, `operation-detection.md`, `operations-dispatch.md`
- `agents/canopy/verify/` — expected-state checklists for `VERIFY_EXPECTED` per operation: `create-expected.md`, `modify-expected.md`, `scaffold-expected.md`, `convert-to-canopy-expected.md`, `convert-to-regular-expected.md`, `improve-expected.md`, `refactor-skills-expected.md`
- `agents/canopy/policies/skill-structure-rules.md`, `writing-rules.md`, `op-naming-rules.md`, `subagent-rules.md`, `debug-rules.md`, `preservation-rules.md`, `category-decision-flowchart.md`, `conversion-expansion-rules.md` — `optimization-rules.md` decomposed into targeted single-concern policy files
- New operations on the `canopy` agent: `IMPROVE` (fix violations, re-categorise resources, align with framework), `ADVISE` (read-only "how to" plans), `REFACTOR_SKILLS` (extract ops/resources shared across > 2 skills to `shared/`), `HELP` (usage reference)
- `skills/canopy-help/SKILL.md` — read-only skill that emits the canopy agent help reference or a specific operation procedure

### Changed

- `agents/canopy.md` — inline operation procedures and constants replaced with `Read <category>/<file>` references; tree examples expanded with a full `release` skill illustration; `REFACTOR_SKILLS` and `HELP` added to operation detection; two new rules added (no duplicate shared ops/resources; verify references after every change)
- `agents/canopy/policies/optimization-rules.md` — now an index table pointing to the decomposed policy files
- `agents/canopy/schemas/explore-schema.json` — `existing_resources` field updated to reference new policy file names
- `docs/FRAMEWORK.md`, `CLAUDE.md` — directory layout updated to show `ops/`, `constants/`, `verify/` under `agents/canopy/`; sync-required note updated to reference `agents/canopy/policies/` instead of the single `optimization-rules.md`
- `docs/README.md` — usage table extended with IMPROVE, ADVISE, REFACTOR_SKILLS, HELP operations

---

## [0.7.0] — 2026-04-13

### Added

- `skills/canopy-debug/skill.md` — new `canopy-debug` skill; traces any Canopy skill with live phase banners and per-node tree tracking; respects Claude Code mode (plan mode simulates mutations, edit mode executes normally)
- `skills/canopy-debug/ops.md` — skill-local ops: `EMIT_PHASE_BANNER` (renders double-box phase banners), `EXECUTE_WITH_TRACE` (drives full skill execution with tracing), `TRACE_NODE` (emits stream one-liner and overwrites trace file per state change), `TRACE_EXECUTE_NODES` (iterates nodes with mode-aware branch evaluation), `WRITE_TRACE_FILE` (overwrites `.canopy-debug-trace.log` with current full-tree snapshot)
- `skills/canopy-debug/policies/debug-output.md` — debug output protocol: dual-channel output (chat stream + trace file), phase registry with ordinals and descriptions, phase banner format, node state symbol table (`→ ⟳ ✓ ◎ ⊘ ✗ ⏸ ⊙`), stream and trace file formats, mode-aware execution rules, ASK interaction protocol, EXPLORE subagent handling, END/HALTED display

### Changed

- `docs/README.md` — added "Failures you can trace to a single node" bullet to the "Why Canopy?" section; references `/canopy-debug` for live phase and per-node tracing

---

## [0.6.0] — 2026-04-12

### Changed

- `agents/canopy-skill.md` → `agents/canopy.md` — agent renamed from `canopy-skill` to `canopy`
- `agents/canopy-skill/` → `agents/canopy/` — agent resource directory renamed to match
- `agents/canopy.md` — frontmatter `name:` updated to `canopy`; `optimization-rules.md` glob updated to `**/canopy/policies/optimization-rules.md`
- `docs/FRAMEWORK.md`, `docs/README.md`, `docs/AUTHORING.md`, `docs/CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` — all `canopy-skill` agent references updated to `canopy`

---

## [0.5.0] — 2026-04-12

### Added

- `agents/canopy-skill.md` — `canopy-skill` promoted from skill to Claude Code agent; handles six operations: CREATE (new skill from description), MODIFY (targeted edits to existing skill), SCAFFOLD (blank skeleton with all dirs), CONVERT_TO_CANOPY (flat skill → Canopy format), VALIDATE (errors, warnings, optimization report), CONVERT_TO_REGULAR (Canopy → flat skill)
- `agents/canopy-skill/templates/skill.md` and `agents/canopy-skill/templates/ops.md` — skeleton templates used by the SCAFFOLD operation
- `AUTHORING.md` — manual skill authoring reference: full anatomy walkthrough, both tree syntaxes with examples, op definition patterns, primitives table, category resource directory reference, and `skill.md` content constraints
- `setup.sh` and `setup.ps1` — agent wiring: symlink/junction each bundled agent `.md` file and its resource directory into `.claude/agents/` (mirrors existing skill symlink pattern)

### Changed

- `agents/canopy-skill/policies/optimization-rules.md` — moved from `skills/canopy-skill/policies/`; content unchanged
- `agents/canopy-skill/schemas/explore-schema.json` — moved from `skills/canopy-skill/schemas/`; content unchanged
- `README.md` — Usage section rewritten around the `canopy-skill` agent (operation table with example invocations); manual authoring content replaced with a link to `AUTHORING.md`; `## Skill Anatomy` section trimmed to structural overview only; Features bullet updated to reflect agent promotion; `AUTHORING.md` added to Directory Structure
- `FRAMEWORK.md` — added `## Framework Agents` section documenting agent format, resource subdirectory conventions, and setup wiring; directory layout updated to show `agents/` alongside `skills/`
- `CONTRIBUTING.md` — sync-required file list updated to reference `agents/canopy-skill/policies/optimization-rules.md`

### Removed

- `skills/canopy-skill/skill.md` and `skills/canopy-skill/ops.md` — superseded by `agents/canopy-skill.md`

---

## [0.4.0] — 2026-04-12

### Added

- Markdown list syntax (`*` nested lists) as an alternative to box-drawing characters for tree definitions — write trees directly under `## Tree` without a fenced code block
- `examples/` documentation split out to `claude-canopy-examples` repo; canopy repo stays submodule-clean

### Changed

- `rules/skill-resources.md` — Tree format section now documents both syntaxes with examples
- `FRAMEWORK.md` — Tree Execution Model section shows both formats side-by-side; Skill-Local ops.md section shows markdown list format as alternative for branching op definitions
- `README.md` — `## Tree` anatomy and minimal example updated to lead with markdown list syntax
- `skills/canopy-skill/policies/optimization-rules.md` — Rule 6 updated to list both formats; markdown list marked as preferred for new/simple trees

---

## [0.3.2] — 2026-04-12

### Added

- community health files for GitHub: `CONTRIBUTING.md`, issue templates, and pull request template

---

## [0.3.1] — 2026-04-12

### Changed

- `README.md` — replaced the broken external examples link with plain repo mention, made the `## Agent` example generic instead of project-specific, and reduced duplication between `Skill Anatomy` and `Writing a Skill`

---

## [0.3.0] — 2026-04-12

### Fixed

- `setup.ps1` — create directory junctions in `.claude/skills/` for each bundled canopy skill so VS Code discovers them outside the submodule boundary
- `setup.sh` — create symlinks in `.claude/skills/` for each bundled canopy skill for the same reason on Linux/macOS

---

## [0.2.0] — 2026-04-12

### Added

- `setup.sh` and `setup.ps1` — submodule setup scripts; create wiring files in the user's project so Claude Code can see both canopy internals and project skills
- `skills/canopy-skill/` — renamed from `optimize-skill`; bundled meta-skill for auditing and optimizing Canopy skills

### Changed

- `README.md` — added "How It Works" diagram showing full skill anatomy; added inline examples in Features; added Skill Anatomy section; rewrote Quick Start Option A (vendored via curl/tar, explicit warning against git clone) and Option B (git submodule + setup script); removed manual Submodule Wiring section
- `FRAMEWORK.md` — removed content duplicated in README (intro paragraph, submodule directory tree, Skill Anatomy); added pointer to README for setup instructions
- `rules/skill-resources.md` — updated standalone note to reference setup scripts

---

## [0.1.0] — 2026-04-12

### Added

- Initial framework release — extracted from home-data-center project
- `FRAMEWORK.md` — full Canopy specification (tree execution model, op lookup order, category resources)
- `rules/skill-resources.md` — ambient rules for standalone use
- `skills/shared/framework/ops.md` — framework primitives: `IF`, `ELSE_IF`, `ELSE`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`
- `skills/shared/project/ops.md` — stub with commented examples for project-wide ops
- `skills/shared/ops.md` — redirect stub
- `skills/canopy-skill/` — bundled meta-skill for auditing and optimizing Canopy skills
- `README.md` — setup instructions for standalone and submodule usage
- `LICENSE` — MIT
- Submodule wiring documentation
