---
paths:
  - "src/**/*.ts"
  - "package.json"
  - "snippets/**"
  - "syntaxes/**"
  - "docs/TEST_SCENARIOS.md"
---

# Rule: keep `docs/TEST_SCENARIOS.md` in sync with code, grammar, snippets, and contributions

`docs/TEST_SCENARIOS.md` is the authoritative manual-test surface for this extension. It catalogs every behavior a release should be smoke-tested against in an Extension Development Host: parsing, diagnostics, hover, go-to-definition, completion, snippets, install commands, agent commands, marker-block writes, language-ID activation, and grammar coverage.

Every change that adds, modifies, or removes user-observable extension behavior must update `docs/TEST_SCENARIOS.md` in the **same PR**. Otherwise the smoke-test surface drifts behind the code, and we publish marketplace versions whose only verification is "the author tried it once."

This is the vscode-side sibling of [`claude-canopy/.claude/rules/test-scenarios-sync.md`](https://github.com/kostiantyn-matsebora/claude-canopy/blob/master/.claude/rules/test-scenarios-sync.md). That rule covers the framework's own `docs/TEST_SCENARIOS.md` (install paths, runtime, authoring ops). This rule covers the extension's.

## What kinds of change require a TEST_SCENARIOS update

| Change | Update required |
|---|---|
| New diagnostic check in `diagnosticsProvider.ts` | New scenario covering the trigger (positive case) and the green path (negative case). Place under the suite that owns the rule's category (e.g. `Diagnostics — manifest drift`, `Diagnostics — subagent dispatch`). |
| New hover handler in `hoverProvider.ts` | New scenario describing the trigger position and the expected hover content. |
| New completion handler in `completionProvider.ts` | New scenario for the position where the completion fires + the expected items. |
| New go-to-definition handler in `definitionProvider.ts` | New scenario for the symbol form + the expected jump target. |
| New op or category recognized by `canopyDocument.ts` / `opRegistry.ts` | New scenario covering the parser case + at least one provider that surfaces it. |
| New snippet in `snippets/canopy.json` | New scenario noting the prefix, expected body shape, and which language IDs it activates on. |
| New language ID, file pattern, or grammar scope in `package.json` / `syntaxes/` | New scenario verifying the highlight in a sample file under that pattern. |
| New install / scaffold / agent command in `commands/` | New scenario covering the Quick Pick path + the resulting on-disk state. |
| MARKER_BLOCK content change | Scenario in the install suite verifying the new bytes (cross-link to the parity rule). |
| Settings key added to `package.json#contributes.configuration` | Scenario covering both default and modified values. |
| Removal of any of the above | Remove the obsolete scenarios; do not let dead checks linger as "this no longer applies" comments. |
| Framework version bump (`canopyVersion`, `.canopy-version`, README badge) | Update the `Tracks canopy v…` header at the top of `docs/TEST_SCENARIOS.md` to match the new version. |

## How to apply

1. **Before opening a PR**, walk the table above and identify which scenarios need additions, modifications, or removals.
2. **Land in the same PR** as the code change. The gap between code merge and scenario update is exactly when regressions slip past the next release smoke-test.
3. **Run the affected scenarios manually** in an Extension Development Host (`F5`) before tagging a release. CI's vitest run covers parsing, diagnostics, and pure-function logic; the F5-only scenarios (hover popups, Quick Pick UX, Marketplace badge sync) need eyeball verification.

## Cross-repo

- The framework's authoring-side rule is at `claude-canopy/.claude/rules/test-scenarios-sync.md`. It references this rule for the extension's manual smoke-test surface.
- The framework's `docs/TEST_SCENARIOS.md` Suite C is intentionally a single-paragraph cross-reference to this extension's scenarios — they don't live there.

## Anti-patterns this rule prevents

- **A new diagnostic ships with no smoke scenario.** S2.5's `metadata.canopy-features` manifest-drift check has five distinct trigger cases (absent/core/unknown/declared-unused/used-undeclared); without explicit scenarios, only the unit tests verify them, and a regression in surfacing (e.g. wrong squiggle range) ships unnoticed.
- **Snippet drift.** A snippet's body changes but the scenario still asserts the old expansion. A v0.14.0 user expanding the `skill` prefix gets `metadata.canopy-features: [interaction, verify]`; a stale scenario expecting no manifest will pass-through as a false positive.
- **Marker block bytes diverge between scenario and code.** When `MARKER_BLOCK` slimmed from ~30 lines to 5 in v0.14.0, every scenario asserting "marker block contains primitives table" had to flip to "marker block points at canopy-runtime/SKILL.md."

## Enforcement

This rule is currently **documentation-only and reviewer-enforced**. If repeated drift recurs, automation candidate: a pre-push check that flags PRs touching `src/**`, `snippets/**`, `syntaxes/**`, or `package.json#contributes` without also touching `docs/TEST_SCENARIOS.md`.
