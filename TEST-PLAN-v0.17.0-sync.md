# Manual test plan — v0.17.0 sync

This is the UI-bound test plan. Automated checks already passed:
- `npm test` — 254/254 passing (250 unit + 4 integration on real SKILL.md)
- `npm run package` — VSIX built clean (31 files, 1.55 MB)
- `bash install.sh --target both --ref canopy-as-agent-skill` against a temp dir produces all six skill dirs + ambient marker blocks
- `MARKER_BLOCK` in `installCanopy.ts` is byte-identical to `install.sh build_marker_block()`

Run this after installing the VSIX (`code --install-extension canopy-skills-0.7.0.vsix` or Extensions panel → ⋯ → Install from VSIX). Or press F5 in this repo to launch Extension Development Host with the source.

## A. Setup

- [ ] Open a fresh empty folder in VS Code (this is your "consumer project" target)
- [ ] Confirm extension activates (status bar / Output → "Canopy Install" channel exists)

## B. `Canopy: Install...` (unified Quick Pick)

- [ ] Run command "Canopy: Install... (pick method)"
- [ ] Quick Pick shows three items
- [ ] **Install (via install script)** → labeled `$(check)` (you have git)
- [ ] **Install as Agent Skill (gh skill)** → labeled `$(warning)` with detail "gh skill subcommand not available — install or upgrade to gh 2.90.0+" (your gh is 2.89.0)
- [ ] **Install as Claude Code Plugin** → labeled `$(check)` or `$(zap)` depending on whether `claude` CLI is on PATH
- [ ] Selecting each routes to its underlying command (verify by Esc out and try directly)

## C. `Canopy: Install (via install script)`

- [ ] Run command — git is detected, no error dialog
- [ ] Target picker offers Claude / GitHub Copilot
- [ ] Skill picker shows three items, all checked by default; descriptions match (canopy = authoring agent, canopy-runtime = execution engine, canopy-debug = trace wrapper)
- [ ] Version input box accepts empty (latest) or `0.17.0`
- [ ] **Use empty (latest)** since v0.17.0 isn't tagged on remote yet — install.sh will fall back to v0.16.0 (highest released tag) — *this is expected drift, see Findings below*
- [ ] OR: enter a version that doesn't exist (`9.9.9`) → expect error in Output channel, error toast
- [ ] After successful install: `.claude/skills/{canopy,canopy-runtime,canopy-debug}/SKILL.md` exist
- [ ] `.canopy-version` written at workspace root (when `--version` was specified)
- [ ] `CLAUDE.md` exists at workspace root with the canopy-runtime marker block
- [ ] If you unchecked one skill, that skill's directory is missing
- [ ] Re-run with `--target` Copilot — `.github/skills/{canopy,canopy-runtime,canopy-debug}/SKILL.md` exist; `.github/copilot-instructions.md` has the marker block

## D. `Canopy: Install as Agent Skill (gh skill)`

- [ ] Run command — error dialog appears: "GitHub CLI v2.90.0+ with the `skill` subcommand is required…"
- [ ] Three buttons: "Use install script" (→ delegates to install-by-copy), "Open gh download" (→ opens cli.github.com), "Cancel"
- [ ] After upgrading gh to 2.90.0+, re-run — agent picker (Claude Code / GitHub Copilot), skill picker, version picker
- [ ] After install: skills land at `.claude/skills/<name>/SKILL.md` (or `.github/skills/`)
- [ ] **Critical:** confirm `CLAUDE.md` (or `.github/copilot-instructions.md`) was written with the canopy-runtime marker block — gh skill itself doesn't write it; the extension does.

## E. `Canopy: Install as Claude Code Plugin`

- [ ] Run command — skill picker shows
- [ ] If you uncheck any skill, modal warning explains plugin install bundles all 3
- [ ] After confirming: clipboard contains the two `/plugin` slash commands
- [ ] If `claude` CLI is on PATH: modal also offers "Open Claude in terminal" — clicking opens an integrated terminal with `claude` running; you paste the slash commands at the Claude prompt
- [ ] If `claude` not on PATH: modal is clipboard-only (no terminal option)

## F. Editor features — open a SKILL.md from one of the just-installed skills

Open `.claude/skills/canopy/SKILL.md` (or any skill).

### F.1 Diagnostics
- [ ] No "Unknown frontmatter field" warnings on `license`, `allowed-tools`, `metadata`, `user-invocable`
- [ ] No "Invalid category" warnings on `Read \`references/…\`` lines
- [ ] If you intentionally add `bogus: yes` to frontmatter → warning fires
- [ ] If you intentionally add `Read \`badcat/foo.md\`` → warning fires

### F.2 Syntax highlighting (light theme makes this visible)
- [ ] In the Tree section, `IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END` all render as control keywords (one color)
- [ ] `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`, `EXPLORE` render as builtin functions (another color)
- [ ] Custom ALL_CAPS ops render as user functions (a third color)

### F.3 Snippets — type a prefix in the Tree section, press Tab
- [ ] `switch` → expands SWITCH/CASE/DEFAULT block
- [ ] `for` → expands FOR_EACH loop
- [ ] `for-break` → expands FOR_EACH with BREAK
- [ ] `read` → cursor in dropdown, choose `references` or `checklists` (both should be options)

### F.4 Completion
- [ ] In frontmatter, type a few letters (e.g. `lic` then Ctrl+Space) → `license` suggested
- [ ] In frontmatter, type `met` → `metadata` suggested
- [ ] In Tree section, type `SW` → `SWITCH` suggested as primitive

### F.5 Hover
- [ ] Hover over `license:` line in frontmatter → doc tip explains SPDX
- [ ] Hover over `metadata:` line → doc tip explains version/author convention
- [ ] Hover over `user-invocable:` line → doc tip explains hide-from-`/`
- [ ] Hover over `SWITCH` in tree → primitive doc tip with signature + example
- [ ] Hover over `FOR_EACH` → same

## G. Agent commands

These need a workspace where canopy-runtime is installed (use the test-dir from C/D).

- [ ] **Canopy Agent: Validate Skill** → skill picker shows non-framework skills only (excludes canopy/canopy-runtime/canopy-debug); selecting one launches Claude CLI in a terminal with `claude "/canopy validate the X skill"`
- [ ] **Canopy Agent: Debug Skill (canopy-debug)** → same skill picker; launches `claude "/canopy-debug X"`
- [ ] If `claude` not on PATH: error dialog "Claude Code CLI (claude) is not on PATH" with "Open Claude Code download" button
- [ ] Copilot target equivalents: agent commands open the chat with `Follow .github/skills/canopy/SKILL.md and validate the X skill` (no claude check needed)

## H. User's existing canopy skills still work

In a workspace that has skills under `.claude/skills/<your-skill>/SKILL.md`:

- [ ] Open one of your skills' SKILL.md — diagnostics pass, syntax-highlighting correct
- [ ] Run `Canopy Agent: Validate Skill` on it → completes without error
- [ ] If you added `license`/`metadata`/`allowed-tools` to your skills, those don't get flagged

## Findings (already known)

1. **`v0.17.0` tag and master not pushed to remote** — install.sh defaults to "latest release" which is v0.16.0. Workaround: install with `--ref canopy-as-agent-skill` (the branch IS on remote). Fix: push the local tag (`git push origin v0.17.0`) and merge canopy-as-agent-skill → master.
2. **`gh` 2.89.0 → upgrade to 2.90.0+ before testing the gh-skill path.**
3. **Plugin install bundles all 3 skills** — by design (no per-skill plugin marketplace). Skill checkboxes for that command are informational; unchecking triggers a confirmation but the install is still bundled.
