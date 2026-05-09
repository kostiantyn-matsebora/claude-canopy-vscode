---
paths:
  - "src/commands/installCanopy.ts"
---

# Rule: MARKER_BLOCK constant must stay byte-identical with claude-canopy sources

The `MARKER_BLOCK` constant in `src/commands/installCanopy.ts` is one of **four sources of truth** for the canopy-runtime marker block. All four must stay byte-identical:

1. `skills/canopy-runtime/assets/constants/marker-block.md` (canonical, in claude-canopy)
2. `install.sh` `build_marker_block()` (in claude-canopy)
3. `install.ps1` `Build-MarkerBlock` (in claude-canopy)
4. `MARKER_BLOCK` in `src/commands/installCanopy.ts` (this repo — the vscode mirror)

## Verify

After updating the constant, run the parity check from the workspace root:

```bash
python install-test/check_parity.py
```

The script reports `OK` / `FAIL` per source. Drift between any pair fails the check. CI on the framework repo runs this check; release-blocking drift is caught there.

## Cross-repo coupling

The canonical source lives in `claude-canopy/`. When the framework's marker block changes, the framework PR updates 3 of the 4 sources (canonical `.md`, `install.sh`, `install.ps1`); this extension's mirror must be updated in a follow-up PR before parity restores.

## Why this matters

The marker block activates `canopy-runtime` ambiently — written into `CLAUDE.md` (Claude Code) or `.github/copilot-instructions.md` (Copilot) by install scripts, by the runtime's `## Activation` section, and by this extension's "Canopy Install" commands. Drift means a project installed via one path gets a different marker than via another, breaking the single-source-of-truth property of the runtime.
