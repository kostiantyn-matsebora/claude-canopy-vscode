---
paths:
  - "src/canopyDocument.ts"
  - "src/opRegistry.ts"
  - "src/providers/diagnosticsProvider.ts"
  - "src/providers/completionProvider.ts"
  - "src/providers/hoverProvider.ts"
  - "src/providers/definitionProvider.ts"
  - "src/extension.ts"
---

# Rule: Extension code invariants

These invariants are load-bearing. Violating them produces subtle bugs that surface only in specific scenarios (cache staleness, false-positive diagnostics, parser drift across providers).

## Parsing — single source of truth

- `canopyDocument.ts` is the **single source of truth** for parsing
- All providers call `parseDocument()`; **never** re-implement parsing in a provider
- Op-name extraction in tree nodes looks **only** at text **before** any `<<` or `>>` — content inside binding expressions is never treated as an op reference

## OpRegistry — singleton, cached

- `OpRegistry` is a singleton (`registry`) shared across all providers
- Cache is keyed by `uri.fsPath` of the parsed file
- **Invalidate the cache** when an `ops.md` (or `references/ops.md`, `references/ops/<name>.md`) changes — wired via file-watcher in `extension.ts`

## Diagnostics — scope and triggers

- Diagnostics run on `onDidOpenTextDocument` and `onDidChangeTextDocument`
- **Only** for `languageId === 'canopy'` — never for `canopy-verify`, `canopy-template`, `canopy-resource`, `canopy-commands` (those have syntax highlighting only)
- Path-pattern matching for filename eligibility lives in `extension.ts` (`CANOPY_FILE_RE`); providers must NOT re-derive eligibility

## Provider registration

- All language providers register against `{ language: 'canopy' }` only — see the Language IDs table in `CLAUDE.md` for the full ID matrix
- Resource-file languages (`canopy-verify` etc.) get TextMate grammars but no provider registration
