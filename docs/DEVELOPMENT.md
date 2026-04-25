# Development Guide

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- `npm install` in the repo root

---

## Build, Test, Package

| Command | What it does |
|---------|-------------|
| `npm run compile` | TypeScript → `out/` (one-shot) |
| `npm run watch` | TypeScript in watch mode |
| `npm test` | Run unit tests with Vitest |
| `npm run package` | Build `.vsix` package for distribution |

### Running the extension locally (dev loop)

Press **F5** in VS Code. This launches an **Extension Development Host** with the extension loaded. Open any `.claude/**/SKILL.md` (or legacy `skill.md`) file to activate IntelliSense and diagnostics.

Every time you change TypeScript source, re-run `npm run compile` (or keep `npm run watch` running) and reload the Extension Development Host window with **Ctrl+Shift+P → Developer: Reload Window**.

### Installing the extension permanently (from .vsix)

Use this to install the built extension into your regular VS Code — not just the dev host.

**Step 1 — build the package:**

```bash
npm run package
# produces canopy-skills-<version>.vsix in the repo root
```

**Step 2 — install:**

Option A — VS Code command line:

```bash
code --install-extension canopy-skills-<version>.vsix
```

Option B — VS Code UI:

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Click the `···` menu (top-right of the panel)
3. Choose **Install from VSIX…**
4. Select the `.vsix` file

**Step 3 — reload VS Code** (`Ctrl+Shift+P → Developer: Reload Window`) so the newly installed version activates.

To uninstall, find **Canopy Skills** in the Extensions panel and click **Uninstall**.

---

## Unit Tests

Tests live in `src/test/` and run with [Vitest](https://vitest.dev/). The Vitest config is at `vitest.config.ts`.

```
npm test
```

### Mock setup

The VS Code API is shimmed by `src/__mocks__/vscode.ts`. Vitest's `resolve.alias` in `vitest.config.ts` redirects all `import vscode from 'vscode'` to that file.

Node.js built-in modules (`fs`) **cannot** be spied on with `vi.spyOn` in ESM mode — use `vi.mock('fs', factory)` instead:

```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
}));
// then per-test:
vi.mocked(fs.existsSync).mockReturnValue(false);
```

The vscode mock (`src/__mocks__/vscode.ts`) is a plain object, so `vi.spyOn` works fine on it.

### Test coverage map

| File | Covers |
|------|--------|
| `canopyDocument.test.ts` | `parseDocument`, `parseOpDefinitions`, `extractReadRefs`, `extractOpRefs`, `getOpNameAtPosition`, `isPrimitive` |
| `resourceParser.test.ts` | `extractCommandsSections`, `extractPlaceholders` |
| `diagnosticsProvider.test.ts` | All `validate()` branches in `CanopyDiagnosticsProvider` |
| `opRegistry.test.ts` | `PRIMITIVE_DOCS`, `OpRegistry.loadDefs`, `invalidate`, `resolve`, `allOpNames` |
| `canopyAgent.test.ts` | `buildAgentPrompt`, `buildDebugPrompt`, `buildClaudeCliCommand`, `projectTargetAt`, `findProjectUpward`, `resolveProjectFromPaths`, `detectCurrentSkill` |
| `installCanopy.test.ts` | `parseGithubRepo`, `targetBaseDir`, `buildGhSkillCommand`, `buildInstallScriptCommand`, `pluginInstallSlashCommands`, `applyMarkerBlock`, `ambientInstructionFile`, `FRAMEWORK_SKILLS` |
| `installMethodPicks.test.ts` | `buildInstallMethodPicks` (icon selection per tool availability, scope detail copy) |
| `availability.test.ts` | `isCommandAvailable` (per-tool probes), `detectTools` (parallel probe of git/gh/claude) |
| `realSkills.test.ts` | Integration: real SKILL.md from sibling `claude-canopy/` and bundled `.claude/skills/` parse with no unknown-frontmatter slips |

---

## Source Architecture

```
src/
  extension.ts              — activate(): registers all providers and commands
  availability.ts           — isCommandAvailable / detectTools (probes git, gh skill, claude)
  canopyDocument.ts         — document model (single source of truth for parsing)
  opRegistry.ts             — OpRegistry singleton + PRIMITIVE_DOCS
  __mocks__/vscode.ts       — VS Code API shim for tests
  providers/
    completionProvider.ts   — frontmatter keys, section headers, op names, Read paths
    hoverProvider.ts        — hover docs for sections, frontmatter, and op names
    definitionProvider.ts   — go-to-definition for ALL_CAPS op names
    diagnosticsProvider.ts  — semantic validation
  commands/
    installCanopy.ts        — install + installByCopy + installAsAgentSkill + installAsPlugin
                              (4 commands) + MARKER_BLOCK / applyMarkerBlock idempotent writer
    canopyAgent.ts          — 11 Canopy agent operation commands incl. agentDebug
    newResource.ts          — 7 scaffold commands
  util/
    resourceParser.ts       — extractCommandsSections, extractPlaceholders
```

### Data flow

```
TextDocument
    │
    ▼
parseDocument()          ← canopyDocument.ts (called by every provider)
    │  returns ParsedSkillDocument
    │    ├── frontmatter[]
    │    ├── sections[]
    │    ├── treeNodes[]    ← each node has opName, hasInput, hasOutput, ...
    │    └── opDefinitions[]
    │
    ├──▶ CompletionProvider   — suggests op names, section headers, paths
    ├──▶ HoverProvider        — shows docs for op / primitive at cursor
    ├──▶ DefinitionProvider   — navigates to ## OP_NAME in ops.md
    └──▶ DiagnosticsProvider  — emits Diagnostic objects to the collection
              │
              └──▶ OpRegistry.resolve() / allOpNames()
                        │
                        └── loads ops.md files from disk (cached)
```

### OpRegistry lookup chain

`OpRegistry.resolve(opName, docUri)` walks the per-skill location and falls back to legacy shared paths (no-ops in v0.17.0+ but kept for back-compat):

1. `<same-dir>/ops.md` (skill-local)
2. Legacy fallback: `<.claude-root>/skills/shared/<kind>/ops.md` and `<.claude-root>/canopy/skills/shared/<kind>/ops.md`

Framework primitives (`IF`, `SWITCH`, `FOR_EACH`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`, `EXPLORE`, …) are defined statically in `PRIMITIVE_DOCS` (in `opRegistry.ts`) — they are **not** loaded from disk. The canonical canopy v0.17.0+ source for primitives is `claude-canopy/skills/canopy-runtime/references/framework-ops.md`; if it diverges, sync `PRIMITIVE_DOCS` per the sync-points table in `CLAUDE.md`.

The registry caches parsed definitions per file path. Call `registry.invalidate(uri)` when an `ops.md` file changes (wired in `extension.ts`).

---

## How to Change the Implementation

### Add a new framework primitive

Primitives are hardcoded in **six** places. All must be updated together — see the sync-points table in `CLAUDE.md` for the canonical list.

1. `canopyDocument.ts` — `PRIMITIVES` set: add the name.
2. `opRegistry.ts` — `PRIMITIVE_DOCS` record: add `{ name, signature, description, example }`.
3. `diagnosticsProvider.ts`:
   - `RESERVED_PRIMITIVES` set: add the name.
   - `checkPrimitiveSignatures()`: add a `case` for the new primitive's signature rules.
4. `completionProvider.ts` — `primitiveCompletions()`: add a `CompletionItem`.
5. `syntaxes/canopy.tmLanguage.json` — add to the `primitive-control` or `primitive-action` regex AND to the `op-call` exclusion regex (otherwise it'll be highlighted as a custom op).
6. `snippets/canopy.json` — consider adding a snippet (see `switch` / `for` for examples) if the primitive has a useful expansion shape.

### Add a new category resource directory

Category dirs appear in **five** places:

1. `diagnosticsProvider.ts` — `VALID_CATEGORIES` set.
2. `completionProvider.ts` — `CATEGORY_DIRS` array.
3. `package.json` — add to the existing `canopy-resource` language ID's `filenamePatterns` if it's a markdown reference dir, OR register a new language ID + grammar entry if it has distinct highlighting needs.
4. `snippets/canopy.json` — add to the `Read resource` snippet's enum dropdown (`${1|...|}` choice list).
5. If a new language ID was added: create the corresponding `.tmLanguage.json` grammar file under `syntaxes/`.

### Add a new diagnostic check

All validation lives in `CanopyDiagnosticsProvider` (`diagnosticsProvider.ts`). To add a check:

1. Add a private method `checkXxx(parsed, lines, diagnostics, ...)`.
2. Call it from `validate()` inside the appropriate `if (parsed.isSkillFile)` or `if (parsed.isOpsFile)` block.
3. Add corresponding tests in `src/test/diagnosticsProvider.test.ts`.

### Add a new frontmatter field

1. `diagnosticsProvider.ts` — add to `FRONTMATTER_ALLOWED` (and `FRONTMATTER_REQUIRED` if mandatory).
2. `completionProvider.ts` — add to `FRONTMATTER_KEYS`.
3. `hoverProvider.ts` — add an entry to `FRONTMATTER_DOCS`.

### Add a new section type (`## Foo`)

1. `canopyDocument.ts` — `parseDocument()`: add an `else if (heading === 'Foo')` branch, set `currentSectionKind`, and set `result.hasFooSection = true` if needed.
2. `canopyDocument.ts` — `SectionKind` type: add `'foo'`.
3. `canopyDocument.ts` — `ParsedSkillDocument` interface: add `hasFooSection?: boolean`.
4. `completionProvider.ts` — `SECTION_NAMES` array.
5. `hoverProvider.ts` — `SECTION_DOCS` record.

### Add a new command

1. Implement the command handler in `src/commands/` (or add to an existing file).
2. Register it in `extension.ts` inside `activate()`.
3. Declare it in `package.json` under `contributes.commands`.

### Change op signature rules (existing primitive)

Edit the matching `case` in `checkPrimitiveSignatures()` in `diagnosticsProvider.ts`. Update `PRIMITIVE_DOCS` in `opRegistry.ts` to keep the hover documentation in sync. Update the corresponding test in `diagnosticsProvider.test.ts`.

### Modify the tree node parser

All tree line parsing is in `parseTreeLine()` in `canopyDocument.ts`. This function is the single source of truth — do not replicate its logic in providers. Tests for it are in `canopyDocument.test.ts` under the `parseDocument — tree node operators` suite.

---

## Key Invariants

- `canopyDocument.ts` is the **only** place that parses document content. Providers call `parseDocument()` and operate on the result — they never parse text directly.
- Op name extraction looks only at text **before** any `<<` or `>>`. Content inside binding expressions is never treated as an op reference.
- `OpRegistry` is a singleton (`registry`) shared across all providers. Always invalidate its cache when `ops.md` changes.
- Diagnostics run only for `languageId === 'canopy'` documents. Resource-file language IDs (`canopy-verify`, etc.) have syntax highlighting only.
- The `## OP_NAME` heading pattern in `parseOpDefinitions()` requires `[A-Z][A-Z0-9_]{1,}` — headings with lowercase names are section headers, not op definitions.

---

## Release workflow

Releases are tag-based. CI runs on every push to `master`; a GitHub Release with the `.vsix` attached is created automatically on `v*` tag push.

```bash
# 1. Bump version in package.json + create local tag
npm version patch        # or minor / major

# 2. If Canopy framework was updated, sync its version
npm run sync-canopy-version

# 3. Update CHANGELOG.md

# 4. Push branch and tag — triggers .github/workflows/release.yml
git push origin master --follow-tags
```

The release workflow verifies that the tag matches `package.json version` before packaging. Pushing the same tag twice is rejected by git — duplicate releases are not possible.

---

## Keeping in Sync with claude-canopy

See [CLAUDE.md](../CLAUDE.md#keeping-in-sync-with-claude-canopy) for the full sync table.
The canonical spec is [`docs/FRAMEWORK.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/docs/FRAMEWORK.md) and `skills/canopy-runtime/references/skill-resources.md` in the framework repo.
