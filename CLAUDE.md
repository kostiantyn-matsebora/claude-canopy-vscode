# CLAUDE.md — claude-canopy-vscode

> **Canopy framework context:** read [`CLAUDE.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/CLAUDE.md) in the `claude-canopy` repo before working on this extension. It covers the framework spec, skill anatomy, tree notation, op lookup order, and category resource directories.

## Canopy Integration

Canopy ships as three [agentskills.io](https://agentskills.io)-format Agent Skills (`canopy-runtime`, `canopy`, `canopy-debug`). They are **not bundled in this repo** — install Canopy as a Claude Code plugin at user scope:

```
/plugin marketplace add kostiantyn-matsebora/claude-canopy
/plugin install canopy@claude-canopy
/canopy:canopy activate
```

The `activate` step (canopy v0.17.1+) writes the canopy-runtime marker block to this repo's `CLAUDE.md` so the user skills under `.claude/skills/` (`bump-version`, `release`, `update`) load runtime ambiently.

The marker block is already committed to this repo's `CLAUDE.md`, so a fresh checkout + plugin install is enough — `activate` is a safe no-op if the block matches the current canopy release. Re-run `activate` after a `/plugin update canopy@claude-canopy` if the new release changed the block content.

> **Extension follow-up needed:** `src/commands/setupCanopy.ts` was removed in v0.17.0. The new install commands live in `src/commands/installCanopy.ts` (`Canopy Install: Install...`, `Canopy Install: Install (via install script)`, `Canopy Install: Install as Agent Skill (gh skill)`, `Canopy Install: Install as Claude Code Plugin`). Pinned to canopy v0.17.1 via `.canopy-version` and `package.json#canopyVersion`.

> **Command palette categories:** three groups in `package.json#contributes.commands`, named so they sort alphabetically into a workflow order — `Canopy Install` → `Canopy Skill` (agent commands) → `Canopy Template` (manual scaffold commands). `canopy.showVersion` stays in the bare `Canopy` category as a meta utility. `Canopy Agent` (the old agent category) was renamed to `Canopy Skill`; the integrated-terminal label in `canopyAgent.ts` (`Canopy Agent (<root>)`) is unrelated and intentionally left as-is — it describes the running agent, not a command group.

## This Repository

`claude-canopy-vscode` is a VS Code extension that provides language support for Canopy skills. It is a sibling repo of `claude-canopy/` in the parent workspace.

- **Package name:** `canopy-skills` — publisher `canopy-ai` (registered on marketplace.visualstudio.com — manage page: https://marketplace.visualstudio.com/manage/publishers/canopy-ai)
- **Current version:** `0.11.0`
- **Tracks canopy:** `0.18.1` (see `.canopy-version`)
- **Remote:** `https://github.com/kostiantyn-matsebora/claude-canopy-vscode`

## Build & Dev

```bash
npm run compile      # tsc — output goes to out/
npm run package      # produces .vsix via @vscode/vsce
```

Dev loop: open in VS Code, press `F5` — launches Extension Development Host with the extension loaded.

## Source Layout

```
src/
  extension.ts                  — activate(): registers all providers and commands
  availability.ts               — isCommandAvailable / detectTools (probes git, gh skill, claude)
  canopyDocument.ts             — document model: parseDocument(), TreeNode, ReadRef, extractReadRefs()
  opRegistry.ts                 — OpRegistry singleton: resolves op names through skill-local → project → framework chain
  providers/
    completionProvider.ts       — op name + primitive completions; tree node prefix insertion
    hoverProvider.ts            — hover docs for primitives and custom ops
    definitionProvider.ts       — go-to-definition for ALL_CAPS op names
    diagnosticsProvider.ts      — semantic validation (frontmatter, tree syntax, primitive signatures, resource refs, op conformance)
  commands/
    installCanopy.ts            — 4 install commands + ambient marker-block writer
    newResource.ts              — 7 scaffold commands (newSkill, newVerifyFile, newTemplate, newConstantsFile, newPolicyFile, newCommandsFile, newSchema)
    canopyAgent.ts              — 11 Canopy agent operation commands
```

## Memory Server

An MCP `memory` server is configured for this project (`.claude/settings.json`). It stores a knowledge graph of the extension architecture so source files don't need to be fully re-read each session.

**Before reading a source file**, call `search_nodes` with the filename or concept (e.g. `"diagnosticsProvider"`, `"canopy-primitives"`).
**After modifying a source file**, call `add_observations` on the relevant entity to keep the graph current.

Key entities in the graph:

| Entity | What it tracks |
|--------|---------------|
| `diagnosticsProvider.ts` | `RESERVED_PRIMITIVES`, `VALID_CATEGORIES`, `FRONTMATTER_REQUIRED/ALLOWED`, `checkPrimitiveSignatures()` coverage |
| `completionProvider.ts` | `CATEGORY_DIRS`, `FRONTMATTER_KEYS`, `SECTION_NAMES` |
| `opRegistry.ts` | `PRIMITIVE_DOCS` map, `OpRegistry` class, resolution chain |
| `canopyDocument.ts` | `parseDocument()`, `TreeNode`, `isPrimitive()`, `extractReadRefs()` |
| `extension.ts` | provider registrations, `ensureCanopyLanguage()`, `CANOPY_FILE_RE`, registered commands |
| `canopy-primitives` | current full primitive list (synced to framework version) |
| `canopy-categories` | current valid category dirs |
| `sync-points` | what to update in the extension when the framework changes |

## Language IDs

All providers register against `{ language: 'canopy' }` only. Resource file languages have syntax highlighting only (no IntelliSense).

| ID | Filename patterns | Purpose |
|----|-------------------|---------|
| `canopy` | `**/SKILL.md`, `**/skill.md`, `**/ops.md` | Full IntelliSense + diagnostics |
| `canopy-verify` | `**/verify/*.md`, `**/checklists/*.md` | Checkbox item highlighting |
| `canopy-template` | `**/templates/*.md`, `**/templates/*.yaml` | `<token>` placeholder highlighting |
| `canopy-resource` | `**/constants/*.md`, `**/policies/*.md`, `**/schemas/*.md`, `**/references/*.md` | Table + numbered-rule highlighting |
| `canopy-commands` | `**/commands/*.ps1`, `**/commands/*.sh` | `# === Section Name ===` highlighting |

Patterns cover both `.claude/` and `.github/` targets. `schemas/*.json` intentionally left as JSON.

## Key Invariants

- `canopyDocument.ts` is the single source of truth for parsing — all providers call `parseDocument()`, never re-implement parsing
- Op name extraction in tree nodes looks only at text **before** any `<<` or `>>` — content inside binding expressions is never treated as op references
- `OpRegistry` is a singleton (`registry`) shared across all providers; invalidate its cache when `ops.md` changes (wired in `extension.ts`)
- Diagnostics run on `onDidOpenTextDocument` and `onDidChangeTextDocument` for `languageId === 'canopy'` only
- Marker block content in `installCanopy.ts` (`MARKER_BLOCK` constant) MUST stay byte-identical with `claude-canopy/install.sh build_marker_block()` and `install.ps1 Build-MarkerBlock`. CI enforces parity (`scripts/validate.sh` in canopy repo) — drift is a release blocker.

## Settings

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `canopy.frameworkUrl` | string | `https://github.com/kostiantyn-matsebora/claude-canopy` | Framework repo URL for install commands |
| `canopy.validate.enabled` | boolean | `true` | Toggle all validation |
| `canopy.validate.unknownOps` | enum | `"warning"` | Severity for unresolved op names |
| `canopy.validate.opConformance` | boolean | `true` | Hints for `<<`/`>>` mismatch vs op signature |

## Keeping in Sync with claude-canopy

This extension is a consumer of the Canopy framework. When `claude-canopy/` changes, the extension must be updated to reflect those changes. Key sync points:

| What changes in `claude-canopy/` | What to update here |
|---|---|
| New framework primitive added to [`skills/canopy-runtime/references/framework-ops.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/skills/canopy-runtime/references/framework-ops.md) | Add to `RESERVED_PRIMITIVES` in `diagnosticsProvider.ts`; add `PRIMITIVE_DOCS` entry in `opRegistry.ts`; add `case` in `checkPrimitiveSignatures()`; add to `primitive-control` or `primitive-action` regex AND op-call exclusion in `syntaxes/canopy.tmLanguage.json`; consider a `snippets/canopy.json` snippet |
| Primitive signature changes (`<<`/`>>` requirements) | Update matching `case` in `checkPrimitiveSignatures()` and `PRIMITIVE_DOCS` |
| New category resource directory added ([`skills/canopy/constants/category-dirs.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/skills/canopy/constants/category-dirs.md)) | Add to `VALID_CATEGORIES` in `diagnosticsProvider.ts`; add to `CATEGORY_DIRS` in `completionProvider.ts`; register new language ID + grammar + filename patterns in `package.json`; update the `Read resource` snippet's enum dropdown in `snippets/canopy.json` |
| Category directory renamed or removed | Update all five locations above |
| Frontmatter fields change ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) — agentskills.io spec governs the canonical field set: `name`, `description`, `argument-hint`, `license`, `metadata`, `allowed-tools`, `user-invocable`) | Update `FRONTMATTER_REQUIRED`, `FRONTMATTER_ALLOWED` in `diagnosticsProvider.ts`; update `FRONTMATTER_KEYS` in `completionProvider.ts`; update `FRONTMATTER_DOCS` map AND the frontmatter-key regex in `hoverProvider.ts` |
| Tree syntax notation changes ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md)) | Update `parseTreeLine()` in `canopyDocument.ts` |
| New section header added (`## Agent`, `## Tree`, etc.) | Update `SECTION_NAMES` in `completionProvider.ts`; update `SECTION_DOCS` in `hoverProvider.ts`; update section parsing in `parseDocument()` |
| Op lookup chain changes ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md)) | Update `OpRegistry` resolution order in `opRegistry.ts` |
| Runtime spec changes (`skills/canopy-runtime/references/runtime-claude.md`, `runtime-copilot.md`, `skill-resources.md`) | No extension-code change normally needed — these are runtime reference docs the canopy-runtime skill loads at execution time |
| `SKILL.md` filename casing changes (legacy `skill.md` ↔ agentskills.io `SKILL.md`) | `canopyDocument.ts` (`isSkillFile`); `extension.ts` (`CANOPY_FILE_RE`); `commands/canopyAgent.ts` (`skillFileExists`); `commands/newResource.ts` (`hasSkillFile`); `package.json` (filename patterns) |
| Framework skill renamed or split (e.g. canopy → canopy + canopy-runtime) | `commands/canopyAgent.ts` (`FRAMEWORK_MARKERS`, `FRAMEWORK_SKILL_NAMES`); `commands/installCanopy.ts` (`FRAMEWORK_SKILLS`) |
| Canopy distribution model changes (install command, skill names) | Update `src/commands/installCanopy.ts` (the four install commands), `src/commands/canopyAgent.ts`, and `.claude/skills/update/commands/update.{sh,ps1}` |
| Ambient instruction protocol changes (canopy-runtime marker block content) | `src/commands/installCanopy.ts` (`MARKER_BLOCK` constant must mirror `claude-canopy/install.sh build_marker_block()` exactly); update the marker block at the bottom of this `CLAUDE.md` too |
| New canopy slash command added (e.g. `/canopy-debug`) | Add a corresponding `agentXxx` function in `src/commands/canopyAgent.ts`, register in `extension.ts`, and add the contribution in `package.json` |

When in doubt, treat [`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) and `skills/canopy-runtime/references/skill-resources.md` as the canonical spec and audit the extension against them.

## Changelog Location

`CHANGELOG.md` (repo root) — update alongside any feature work.

<!-- canopy-runtime-begin -->
## Canopy Runtime

Any `SKILL.md` under `.claude/skills/` or `.github/skills/` that declares a `## Tree`
section is a canopy-flavored skill. Before interpreting it, load
`<skills-root>/canopy-runtime/SKILL.md` and apply the execution model defined
there — sections (`## Agent`, `## Tree`, `## Rules`, `## Response:`), tree
notation (`<<`, `>>`, `|`), control-flow and interaction primitives, op lookup
chain (skill-local ops.md → consumer project ops → framework primitives),
category directory semantics (`schemas/`/`templates/`/`commands/`/`constants/`/
`checklists/`/`policies/`/`verify/`/`references/`), subagent contract
(`EXPLORE` as first node when `## Agent` declares `**explore**`), and the
active platform runtime (`references/runtime-claude.md` or
`references/runtime-copilot.md`).

`<skills-root>` resolves to `.claude/skills/` on Claude Code and `.github/skills/`
on Copilot.
<!-- canopy-runtime-end -->
