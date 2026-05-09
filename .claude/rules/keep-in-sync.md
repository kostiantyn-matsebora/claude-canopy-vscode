---
paths:
  - "src/providers/diagnosticsProvider.ts"
  - "src/providers/completionProvider.ts"
  - "src/providers/hoverProvider.ts"
  - "src/providers/definitionProvider.ts"
  - "src/canopyDocument.ts"
  - "src/opRegistry.ts"
  - "src/commands/installCanopy.ts"
  - "src/commands/canopyAgent.ts"
  - "src/commands/newResource.ts"
  - "syntaxes/canopy.tmLanguage.json"
  - "snippets/canopy.json"
  - "package.json"
  - ".canopy-version"
  - "README.md"
  - "CHANGELOG.md"
---

# Rule: Keeping the extension in sync with claude-canopy

This extension is a consumer of the Canopy framework. When `claude-canopy/` changes, the extension must follow. The table below maps each kind of framework change to the extension files that must update in lockstep.

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
| Subagent dispatch model added (per-op marker + bold call-site, framework v0.20.0+) | Update `parseTreeLine` in `canopyDocument.ts` (bold-op-call detection, `subagentCall` flag); `parseOpDefinitions` (marker parsing, `isSubagent`/`outputContract`/`inputContract`/`markerLine` fields); add diagnostics in `diagnosticsProvider.ts` (`checkSubagentCallSites`, `checkSubagentMarkerDefs`); annotate hover (`hoverProvider.ts`); add schema-ref goto in `definitionProvider.ts`; add `subagent-call` and `subagent-marker` scopes in `syntaxes/canopy.tmLanguage.json`; add `op-subagent` and `call-subagent` snippets in `snippets/canopy.json` |
| Primitive slice spec restructure (framework v0.21.0+ — `references/ops.md` index + per-slice `references/ops/<slice>.md`, where `<slice>` is `core` / `interaction` / `control-flow` / `parallel` / `subagent` / `explore` / `verify`) | Add a `slice: PrimitiveSlice` field to each `PRIMITIVE_DOCS` entry in `opRegistry.ts`; surface it via hover (`hoverProvider.ts` — `Slice: <name>` line under the signature). When a new slice is added, extend the `PrimitiveSlice` union and the `CANOPY_FEATURE_VALUES` set in `canopyDocument.ts`. |
| `metadata.canopy-features` manifest added (framework v0.21.0+ — per-skill slice declaration; runtime lazy-loads only the named slices) | Parse the manifest in `canopyDocument.ts` (`canopyFeatures`, `canopyFeaturesLine` on `ParsedSkillDocument`; track `metadataFields` for the `metadata:` block); add `computeUsedFeatures()` walking the tree → set of slices used. In `diagnosticsProvider.ts`, add `checkCanopyFeaturesManifest()` covering five drift cases — manifest absent (Warning), `core` listed (Error), unknown values (Error), declared-but-unused (Error), used-but-undeclared (Error); add `canopy-features` to the metadata-block allowed set. Hover for `metadata.canopy-features` in `hoverProvider.ts`; completion of slice names inside `[...]` in `completionProvider.ts`. New Skill snippet in `snippets/canopy.json` emits `canopy-features` matching its default body. **Note:** vscode-side drift is `Error` (author-time strictness); framework `/canopy validate` emits `Warning` (runtime warn-and-continue). |
| Ambient instruction protocol changes (canopy-runtime marker block content) | `src/commands/installCanopy.ts` (`MARKER_BLOCK` constant must mirror `claude-canopy/install.sh build_marker_block()` exactly); update the marker block at the bottom of `CLAUDE.md` too |
| New canopy slash command added (e.g. `/canopy-debug`) | Add a corresponding `agentXxx` function in `src/commands/canopyAgent.ts`, register in `extension.ts`, and add the contribution in `package.json` |
| **Framework version bump** (every release of `claude-canopy`, even if the API surface didn't change) | Update **all three** version-tracking strings in lockstep: `package.json#canopyVersion`, `.canopy-version`, and the **"Tracks framework vX.Y.Z"** sentence in `README.md` (line ~17, the marketplace blurb). The CHANGELOG version-bump bullet should call out all three. Stale README badge is the one most likely to be missed because it's prose, not code — grep `Tracks framework` before pushing. |

When in doubt, treat [`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) and `skills/canopy-runtime/references/skill-resources.md` as the canonical spec and audit the extension against them.

## Pre-push grep checks

For any framework-bump PR, run these before pushing:

```bash
# Every "Tracks framework v…" / "framework vX.Y.Z" mention in README:
grep -n "Tracks framework\|framework v[0-9]" README.md

# Confirm package.json#canopyVersion + .canopy-version + README all match:
node -e "console.log(require('./package.json').canopyVersion)"
cat .canopy-version
```

The three values must agree. README is the easiest to forget because it lives in prose and isn't part of the build.
