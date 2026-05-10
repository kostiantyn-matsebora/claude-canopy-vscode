# CLAUDE.md — claude-canopy-vscode

> **Canopy framework context:** read [`CLAUDE.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/CLAUDE.md) in the `claude-canopy` repo before working on this extension. It covers the framework spec, skill anatomy, tree notation, op lookup order, and category resource directories.

## What this repo is

- **Package:** `canopy-skills` — publisher `canopy-ai` (registered on marketplace.visualstudio.com — [manage page](https://marketplace.visualstudio.com/manage/publishers/canopy-ai))
- **Role:** VS Code extension that provides language support (syntax highlighting, IntelliSense, diagnostics, hover, go-to-definition) for Canopy skills
- **Sibling of** `claude-canopy/` in the parent workspace
- **Current version:** see `package.json` → `version`
- **Tracks canopy:** see `package.json` → `canopyVersion` and `.canopy-version`
- **Remote:** https://github.com/kostiantyn-matsebora/claude-canopy-vscode

## Canopy integration

- Canopy ships as three [agentskills.io](https://agentskills.io) Agent Skills (`canopy-runtime`, `canopy`, `canopy-debug`) — **not bundled in this repo**
- Install via Claude Code plugin marketplace at user scope:
  ```
  /plugin marketplace add kostiantyn-matsebora/claude-canopy
  /plugin install canopy@claude-canopy
  ```
- Activation is automatic — canopy-runtime self-activates on first load and writes the marker block to this repo's `CLAUDE.md`
- The marker block is already committed below, so a fresh checkout + plugin install is enough; running `/canopy:canopy activate` is a safe no-op when the block matches the current canopy release
- Re-run activation after `/plugin update canopy@claude-canopy` if the new release changed the block content

## Build & dev

- `npm run compile` — runs `tsc -p ./`; output in `out/`
- `npm run package` — produces `.vsix` via `@vscode/vsce`
- `npm test` — runs vitest suite
- Dev loop: open in VS Code, press `F5` → launches Extension Development Host with the extension loaded

## Source layout

```
src/
  extension.ts                  — activate(): registers all providers and commands
  availability.ts               — isCommandAvailable / detectTools (probes git, gh skill, claude)
  canopyDocument.ts             — document model: parseDocument(), TreeNode, ReadRef, extractReadRefs()
  opRegistry.ts                 — OpRegistry singleton: skill-local → project → framework lookup chain
  providers/
    completionProvider.ts       — op name + primitive completions; tree node prefix insertion
    hoverProvider.ts            — hover docs for primitives and custom ops
    definitionProvider.ts       — go-to-definition for ALL_CAPS op names
    diagnosticsProvider.ts      — semantic validation (frontmatter, tree, primitives, resource refs, op conformance)
  commands/
    installCanopy.ts            — 4 install commands + ambient marker-block writer
    newResource.ts              — 7 scaffold commands (newSkill, newVerifyFile, newTemplate, newConstantsFile, newPolicyFile, newCommandsFile, newSchema)
    canopyAgent.ts              — 11 Canopy agent operation commands
```

## Language IDs

All language providers register against `{ language: 'canopy' }` only. Resource-file languages get syntax highlighting but no IntelliSense.

| ID | Filename patterns | Purpose |
|----|-------------------|---------|
| `canopy` | `**/SKILL.md`, `**/skill.md`, `**/ops.md` | Full IntelliSense + diagnostics |
| `canopy-verify` | `**/verify/*.md`, `**/checklists/*.md` | Checkbox item highlighting |
| `canopy-template` | `**/templates/*.md`, `**/templates/*.yaml` | `<token>` placeholder highlighting |
| `canopy-resource` | `**/constants/*.md`, `**/policies/*.md`, `**/schemas/*.md`, `**/references/*.md` | Table + numbered-rule highlighting |
| `canopy-commands` | `**/commands/*.ps1`, `**/commands/*.sh` | `# === Section Name ===` highlighting |

Patterns cover both `.claude/` and `.github/` targets. `schemas/*.json` intentionally left as JSON.

## Settings

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `canopy.frameworkUrl` | string | `https://github.com/kostiantyn-matsebora/claude-canopy` | Framework repo URL for install commands |
| `canopy.validate.enabled` | boolean | `true` | Toggle all validation |
| `canopy.validate.unknownOps` | enum | `"warning"` | Severity for unresolved op names |
| `canopy.validate.opConformance` | boolean | `true` | Hints for `<<`/`>>` mismatch vs op signature |

## Key invariants & sync points

These move out of CLAUDE.md to keep it lean and to load the relevant guidance only when relevant files are open:

- **`.claude/rules/keep-in-sync.md`** — full table mapping each kind of `claude-canopy/` change to extension files that must update (primitives, categories, frontmatter, tree syntax, sections, op-lookup chain, marker block, etc.). Loads when any framework-tracking source file is open.
- **`.claude/rules/marker-block-parity.md`** — `MARKER_BLOCK` constant in `src/commands/installCanopy.ts` is one of 4 sources of truth that must stay byte-identical with framework sources. Verify with `python install-test/check_parity.py`. Loads when `installCanopy.ts` is open.
- **`.claude/rules/code-invariants.md`** — parsing single-source-of-truth, op-name extraction rule, `OpRegistry` singleton + cache invalidation, diagnostics scope (canopy languageId only). Loads when affected source files are open.

## Memory server

An MCP `memory` server is configured for this project (`.claude/settings.json`). It stores a knowledge graph of the extension architecture so source files don't need to be fully re-read each session.

- **Before reading a source file:** call `search_nodes` with the filename or concept (e.g. `"diagnosticsProvider"`, `"canopy-primitives"`)
- **After modifying a source file:** call `add_observations` on the relevant entity to keep the graph current

Key entities:

| Entity | Tracks |
|--------|---------------|
| `diagnosticsProvider.ts` | `RESERVED_PRIMITIVES`, `VALID_CATEGORIES`, `FRONTMATTER_REQUIRED/ALLOWED`, `checkPrimitiveSignatures()` coverage |
| `completionProvider.ts` | `CATEGORY_DIRS`, `FRONTMATTER_KEYS`, `SECTION_NAMES` |
| `opRegistry.ts` | `PRIMITIVE_DOCS` map, `OpRegistry` class, resolution chain |
| `canopyDocument.ts` | `parseDocument()`, `TreeNode`, `isPrimitive()`, `extractReadRefs()` |
| `extension.ts` | provider registrations, `ensureCanopyLanguage()`, `CANOPY_FILE_RE`, registered commands |
| `canopy-primitives` | current full primitive list (synced to framework version) |
| `canopy-categories` | current valid category dirs |
| `sync-points` | what to update in the extension when the framework changes |

## Command palette categories

`package.json#contributes.commands` groups commands into three categories that sort alphabetically into a workflow order:

- **`Canopy Install`** — install commands (`Install...`, `Install (via install script)`, `Install as Agent Skill (gh skill)`, `Install as Claude Code Plugin`)
- **`Canopy Skill`** — agent operation commands (renamed from `Canopy Agent` in v0.17.x; the integrated-terminal label `Canopy Agent (<root>)` in `canopyAgent.ts` is intentionally unrelated — it describes the running agent, not a command group)
- **`Canopy Template`** — manual scaffold commands

`canopy.showVersion` stays in the bare `Canopy` category as a meta utility.

## Changelog

`CHANGELOG.md` (repo root) — update alongside any feature work.

<!-- canopy-runtime-begin -->
## Canopy Runtime

Any `SKILL.md` declaring a `## Tree` section is canopy-flavored. To interpret, load `<skills-root>/canopy-runtime/SKILL.md` (where `<skills-root>` is the first match of `.agents/skills/`, `.claude/skills/`, `.github/skills/`). The runtime SKILL.md handles platform detection, op lookup, and lazy-loads only the spec slices the skill actually uses (per `metadata.canopy-features`).
<!-- canopy-runtime-end -->
