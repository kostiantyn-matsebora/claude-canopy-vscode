# Sync Points

Framework change type → extension files that need updating.

| Change Type | Extension Files to Update |
|-------------|--------------------------|
| `NEW_PRIMITIVE` | `src/providers/diagnosticsProvider.ts` (add to `RESERVED_PRIMITIVES`); `src/opRegistry.ts` (add `PRIMITIVE_DOCS` entry); `src/providers/diagnosticsProvider.ts` (add `case` in `checkPrimitiveSignatures()`) |
| `PRIMITIVE_SIGNATURE` | `src/providers/diagnosticsProvider.ts` (update `case` in `checkPrimitiveSignatures()`); `src/opRegistry.ts` (update `PRIMITIVE_DOCS`) |
| `NEW_CATEGORY` | `src/providers/diagnosticsProvider.ts` (add to `VALID_CATEGORIES`); `src/providers/completionProvider.ts` (add to `CATEGORY_DIRS`); `package.json` (register new language ID, grammar, filename patterns) |
| `CATEGORY_RENAMED` | `src/providers/diagnosticsProvider.ts` (update `VALID_CATEGORIES`); `src/providers/completionProvider.ts` (update `CATEGORY_DIRS`); `package.json` (update language ID, grammar, filename patterns) |
| `CATEGORY_REMOVED` | `src/providers/diagnosticsProvider.ts` (remove from `VALID_CATEGORIES`); `src/providers/completionProvider.ts` (remove from `CATEGORY_DIRS`); `package.json` (remove language ID, grammar, filename patterns) |
| `FRONTMATTER_CHANGE` | `src/providers/diagnosticsProvider.ts` (`FRONTMATTER_REQUIRED`, `FRONTMATTER_ALLOWED`); `src/providers/completionProvider.ts` (`FRONTMATTER_KEYS`); `src/providers/hoverProvider.ts` (`FRONTMATTER_DOCS` map AND the regex on the frontmatter-key match) |
| `TREE_SYNTAX` | `src/canopyDocument.ts` (`parseTreeLine()`) |
| `SECTION_HEADER` | `src/providers/completionProvider.ts` (`SECTION_NAMES`); `src/providers/hoverProvider.ts` (`SECTION_DOCS`); `src/canopyDocument.ts` (`parseDocument()`) |
| `OP_LOOKUP_CHAIN` | `src/opRegistry.ts` (resolution order) |
| `SKILL_FILENAME_CASE` | `src/canopyDocument.ts` (`isSkillFile`); `src/extension.ts` (`CANOPY_FILE_RE`); `src/commands/canopyAgent.ts` (`skillFileExists`); `src/commands/newResource.ts` (`hasSkillFile`); `package.json` (filename patterns) |
| `FRAMEWORK_SKILL_RENAMED` | `src/commands/canopyAgent.ts` (`FRAMEWORK_MARKERS`, `FRAMEWORK_SKILL_NAMES`); `CLAUDE.md` (sync table paths) |
