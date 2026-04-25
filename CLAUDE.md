# CLAUDE.md — claude-canopy-vscode

> **Canopy framework context:** read [`CLAUDE.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/main/CLAUDE.md) in the `claude-canopy` repo before working on this extension. It covers the framework spec, skill anatomy, tree notation, op lookup order, and category resource directories.

## Canopy Integration

Canopy ships as three [agentskills.io](https://agentskills.io)-format Agent Skills, split along authoring-vs-execution lines. This repo embeds them into `.claude/skills/` (Claude Code) AND `.github/skills/` (GitHub Copilot, since this repo serves both):

- `canopy-runtime` — execution engine. Interprets canopy-flavored skills at runtime (platform detection, primitives spec, op lookup chain, category semantics, subagent contract). Hidden from the `/` menu; loaded ambiently via `CLAUDE.md` / `.github/copilot-instructions.md` (install script writes marker block).
- `canopy` — authoring agent. Create/modify/validate/improve/scaffold/refactor/advise/convert skills. Provides `/canopy`. Depends on `canopy-runtime`.
- `canopy-debug` — trace wrapper. `/canopy-debug <skill>` emits phase banners and per-node tracing.

To update to a newer release (easiest path — also wires ambient CLAUDE.md + copilot-instructions.md):

```bash
curl -sSL https://raw.githubusercontent.com/kostiantyn-matsebora/claude-canopy/master/install.sh | bash -s -- --target both --version 0.18.0
```

Or per-skill via `gh skill` (does not write ambient files):

```bash
for s in canopy-runtime canopy canopy-debug; do
  gh skill install kostiantyn-matsebora/claude-canopy $s --agent claude-code    --scope project --pin v0.18.0 --force
  gh skill install kostiantyn-matsebora/claude-canopy $s --agent github-copilot --scope project --pin v0.18.0 --force
done
```

> **Extension follow-up needed:** `src/commands/canopyAgent.ts` and the `update` skill in `.claude/skills/` still expect the legacy `.claude/canopy/` subtree path. Both will misbehave until updated to the new install model. Tracked in a separate plan.

## This Repository

`claude-canopy-vscode` is a VS Code extension that provides language support for Canopy skills. It is a sibling repo of `claude-canopy/` in the parent workspace.

- **Package name:** `canopy-skills` — publisher `canopy` (must be registered on marketplace.visualstudio.com, not GitHub)
- **Current version:** `0.3.0`
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
  canopyDocument.ts             — document model: parseDocument(), TreeNode, ReadRef, extractReadRefs()
  opRegistry.ts                 — OpRegistry singleton: resolves op names through skill-local → project → framework chain
  providers/
    completionProvider.ts       — op name + primitive completions; tree node prefix insertion
    hoverProvider.ts            — hover docs for primitives and custom ops
    definitionProvider.ts       — go-to-definition for ALL_CAPS op names
    diagnosticsProvider.ts      — semantic validation (frontmatter, tree syntax, primitive signatures, resource refs, op conformance)
  commands/
    setupCanopy.ts              — addAsSubmodule, addAsCopy (both support Claude + GitHub Copilot targets)
    newResource.ts              — 7 scaffold commands (newSkill, newVerifyFile, newTemplate, newConstantsFile, newPolicyFile, newCommandsFile, newSchema)
    canopyAgent.ts              — 10 Canopy agent operation commands
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
| `extension.ts` | provider registrations, `ensureCanopyLanguage()`, `CANOPY_FILE_RE` |
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

## Settings

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `canopy.frameworkUrl` | string | `https://github.com/kostiantyn-matsebora/claude-canopy` | Framework repo URL for setup commands |
| `canopy.validate.enabled` | boolean | `true` | Toggle all validation |
| `canopy.validate.unknownOps` | enum | `"warning"` | Severity for unresolved op names |
| `canopy.validate.opConformance` | boolean | `true` | Hints for `<<`/`>>` mismatch vs op signature |

## Keeping in Sync with claude-canopy

This extension is a consumer of the Canopy framework. When `claude-canopy/` changes, the extension must be updated to reflect those changes. Key sync points:

| What changes in `claude-canopy/` | What to update here |
|---|---|
| New framework primitive added to [`skills/canopy-runtime/references/framework-ops.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/skills/canopy-runtime/references/framework-ops.md) | Add to `RESERVED_PRIMITIVES` in `diagnosticsProvider.ts`; add `PRIMITIVE_DOCS` entry in `opRegistry.ts`; add `case` in `checkPrimitiveSignatures()` |
| Primitive signature changes (`<<`/`>>` requirements) | Update matching `case` in `checkPrimitiveSignatures()` and `PRIMITIVE_DOCS` |
| New category resource directory added ([`skills/canopy/constants/category-dirs.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/skills/canopy/constants/category-dirs.md)) | Add to `VALID_CATEGORIES` in `diagnosticsProvider.ts`; add to `CATEGORY_DIRS` in `completionProvider.ts`; register new language ID + grammar + filename patterns in `package.json` |
| Category directory renamed or removed | Update all four locations above |
| Frontmatter fields change ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) — agentskills.io spec governs the canonical field set: `name`, `description`, `argument-hint`, `license`, `metadata`, `allowed-tools`, `user-invocable`) | Update `FRONTMATTER_REQUIRED`, `FRONTMATTER_ALLOWED` in `diagnosticsProvider.ts`; update `FRONTMATTER_KEYS` in `completionProvider.ts`; update `FRONTMATTER_DOCS` map AND the frontmatter-key regex in `hoverProvider.ts` |
| Tree syntax notation changes ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md)) | Update `parseTreeLine()` in `canopyDocument.ts` |
| New section header added (`## Agent`, `## Tree`, etc.) | Update `SECTION_NAMES` in `completionProvider.ts`; update `SECTION_DOCS` in `hoverProvider.ts`; update section parsing in `parseDocument()` |
| Op lookup chain changes ([`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md)) | Update `OpRegistry` resolution order in `opRegistry.ts` |
| Runtime spec changes (`skills/canopy-runtime/references/runtime-claude.md`, `runtime-copilot.md`, `skill-resources.md`) | No extension-code change normally needed — these are runtime reference docs the canopy-runtime skill loads at execution time |
| `SKILL.md` filename casing changes (legacy `skill.md` ↔ agentskills.io `SKILL.md`) | `canopyDocument.ts` (`isSkillFile`); `extension.ts` (`CANOPY_FILE_RE`); `commands/canopyAgent.ts` (`skillFileExists`); `commands/newResource.ts` (`hasSkillFile`); `package.json` (filename patterns) |
| Framework skill renamed or split (e.g. canopy → canopy + canopy-runtime) | `commands/canopyAgent.ts` (`FRAMEWORK_MARKERS`, `FRAMEWORK_SKILL_NAMES`); `commands/installCanopy.ts` (`FRAMEWORK_SKILLS`) |
| Canopy distribution model changes (install command, skill names) | Update `src/commands/installCanopy.ts` (the three install commands), `src/commands/canopyAgent.ts`, and `.claude/skills/update/commands/update.{sh,ps1}` |
| New framework primitive added | Beyond `RESERVED_PRIMITIVES` / `PRIMITIVE_DOCS` / `checkPrimitiveSignatures()`: also add to `syntaxes/canopy.tmLanguage.json` (primitive-control or primitive-action regex AND the op-call exclusion regex) and consider a `snippets/canopy.json` snippet |
| New category dir added | Beyond `VALID_CATEGORIES` / `CATEGORY_DIRS` / `package.json` filename patterns: also add to the `Read resource` snippet's enum dropdown in `snippets/canopy.json` |
| Ambient instruction protocol changes (canopy-runtime marker block content) | `src/commands/installCanopy.ts` (`MARKER_BLOCK` constant must mirror `claude-canopy/install.sh build_marker_block()` exactly) |
| New canopy slash command added (e.g. `/canopy-debug`) | Add a corresponding `agentXxx` function in `src/commands/canopyAgent.ts`, register in `extension.ts`, and add the contribution in `package.json` |

When in doubt, treat [`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) and `skills/canopy-runtime/references/skill-resources.md` as the canonical spec and audit the extension against them.

## Changelog Location

`CHANGELOG.md` (repo root) — update alongside any feature work.
