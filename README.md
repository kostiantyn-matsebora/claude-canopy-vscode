# Canopy Skills for VS Code

> Write Claude Code / GitHub Copilot skills as executable code, not prose.

[![Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/canopy-ai.canopy-skills?label=marketplace&color=0969da)](https://marketplace.visualstudio.com/items?itemName=canopy-ai.canopy-skills)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/canopy-ai.canopy-skills?color=0969da)](https://marketplace.visualstudio.com/items?itemName=canopy-ai.canopy-skills)
[![Latest Release](https://img.shields.io/github/v/release/kostiantyn-matsebora/claude-canopy-vscode?label=release&color=0969da)](https://github.com/kostiantyn-matsebora/claude-canopy-vscode/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-0969da)](LICENSE)

IntelliSense, semantic diagnostics, and go-to-definition for [Canopy](https://github.com/kostiantyn-matsebora/claude-canopy) skills — the declarative, tree-structured execution framework for AI agents. Tracks framework **v0.17.1**.

> **Available on the VS Code Marketplace** under the [`canopy-ai`](https://marketplace.visualstudio.com/publishers/canopy-ai) publisher — search for **Canopy Skills** in the Extensions panel, or install via `code --install-extension canopy-ai.canopy-skills`. Pre-Marketplace `.vsix` artifacts are still attached to each [GitHub Release](https://github.com/kostiantyn-matsebora/claude-canopy-vscode/releases/latest) for offline installs.

## What is Canopy?

**Canopy** is a framework for writing AI skills as structured, executable code rather than freeform prose. Instead of describing what an AI agent should do in plain text, you define skills as a tree of named operations with explicit control flow, inputs, and outputs — then run them through Claude Code or GitHub Copilot.

A Canopy skill looks like this:

```markdown
---
name: review-pr
description: Review a pull request for correctness and style
---

## Tree

* FETCH_PR << PR_URL
* IF << changes_are_large >>
  * SPLIT_INTO_SECTIONS
* ELSE
  * REVIEW_IN_ONE_PASS
* SHOW_PLAN >> review_summary
```

Key ideas:

- **Skills** (`SKILL.md`) define behavior as a tree of operation calls.
- **Ops** (`ops.md`) define reusable named operations local to a skill or shared across skills.
- **Framework primitives** (`IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`, `EXPLORE`) are built-in control-flow + interaction + execution ops provided by the framework.
- **Resources** (constants, policies, templates, schemas, verify checklists, command scripts, references) are supporting files co-located with each skill.
- Skills can target **Claude Code** (`.claude/skills/`) or **GitHub Copilot** (`.github/skills/`).

Canopy turns AI instructions into something you can read, review, version-control, lint, and refactor — like real code.

## Installation

The extension is distributed as a `.vsix` on GitHub Releases until the Marketplace listing is live.

1. Download the latest `canopy-skills-<version>.vsix` from the [Releases page](https://github.com/kostiantyn-matsebora/claude-canopy-vscode/releases/latest).
2. Install from the command line:
   ```bash
   code --install-extension canopy-skills-<version>.vsix
   ```
   Or in VS Code: **Extensions** panel → **…** menu → **Install from VSIX…** → pick the file.

## Quick Start

Open your project, then run these from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

1. **`Canopy Install: Install...`**
   - Pick an install method: script / `gh skill` / Claude Code plugin
   - Pick a target: Claude Code or Copilot
   - Installs the three framework skills and writes the runtime marker block
2. **Create your first skill** (requires `claude` or `gh copilot` on `PATH`)
   - **`Canopy Skill: Create Skill`** — describe it in plain English; the agent scaffolds and validates
   - **`Canopy Template: New Skill`** — drop a blank `SKILL.md` + `ops.md` and hand-author
3. **Edit the generated `SKILL.md`** — these activate automatically:
   - Autocomplete for primitives and custom ops
   - Hover docs on every `ALL_CAPS` identifier
   - `F12` go-to-definition
   - Real-time diagnostics with Quick Fixes
4. **Run the skill** from your AI agent
   - Claude Code auto-discovers `.claude/skills/`
   - Copilot loads `.github/skills/`
   - Iterate with `Canopy Skill: Modify / Validate / Improve Skill`

## What this extension does

Turns Canopy skill files into a first-class editor experience: live semantic validation with Quick Fixes, autocomplete for every primitive and custom op, inline hover docs, and go-to-definition across the skill → project → framework op lookup chain. Ships scaffolding commands for every resource type plus direct integration with the Canopy AI agent via `claude` or `gh copilot suggest`.

## In action

### Autocomplete for primitives and custom ops

Type a tree-node prefix and get completions for every `IF`, `ELSE`, `ASK`, `SHOW_PLAN`, `VERIFY_EXPECTED`, and any custom op defined in the current skill, the project, or the framework.

![Autocomplete popup showing primitives with their signatures](images/screenshots/autocomplete.png)

### Semantic diagnostics with Quick Fixes

Real-time validation catches primitive signature violations, missing frontmatter, wrong `<<`/`>>` usage, and broken resource references — before you run the skill.

![Diagnostic squiggle on VERIFY_EXPECTED with a Quick Fix suggesting the correct path syntax](images/screenshots/diagnostics.png)

### Inline documentation for every primitive

Hover any `ALL_CAPS` identifier to see its signature, description, and how it flows with `<<` / `>>` — no context switching to the framework docs.

![Hover tooltip showing SHOW_PLAN primitive documentation and example usage](images/screenshots/hover-docs.png)

## Commands

All commands are accessible via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`). Commands are grouped into three categories that sort alphabetically in the palette to give you a natural workflow order: **Canopy Install** → **Canopy Skill** → **Canopy Template**.

### Install (`Canopy Install` category)

Install the Canopy framework into your project. Each command shows a Quick Pick of the three skills (canopy, canopy-runtime, canopy-debug) — all checked by default.

| Command | What it does |
|---|---|
| **Install...** | Unified entry point; presents a Quick Pick of the three install methods with availability badges based on which CLIs (`git`, `gh skill`, `claude`) are on PATH |
| **Install (via install script)** | Clone canopy and run `install.sh` / `install.ps1`. Picks Claude or Copilot target; writes the canopy-runtime ambient marker block automatically. Requires `git`. |
| **Install as Agent Skill (gh skill)** | `gh skill install` per checked skill. Picks Claude Code or GitHub Copilot agent. Writes the marker block too (gh skill itself doesn't). Requires `gh` ≥ 2.90.0. |
| **Install as Claude Code Plugin** | Copies the three `/plugin` slash commands (marketplace add + install + activate) to clipboard for paste in a Claude Code session. Plugin install bundles all three skills. |

### ✨ Skill — describe it, let AI write it (`Canopy Skill` category)

**Start here.** No deep framework knowledge required — describe what you want in plain English and the Canopy AI agent writes, validates, and refines the skill for you. Auto-detects the installed AI target (Claude Code under `.claude/` or GitHub Copilot under `.github/`) and invokes `claude "<prompt>"` or `gh copilot suggest "<prompt>"`.

| Command | What it does |
|---|---|
| **Create Skill** | Describe a skill; the agent writes it end-to-end |
| **Modify Skill** | Pick a skill and describe the change |
| **Scaffold Skill** | Provide a name; the agent creates the blank structure |
| **Convert to Canopy** | Converts a plain-markdown skill to Canopy tree format |
| **Validate Skill** | Checks a skill against all framework rules |
| **Improve Skill** | Aligns a skill with the latest framework conventions |
| **Advise** | Ask the agent a design question about Canopy |
| **Refactor Skills** | Extracts shared ops and resources across multiple skills |
| **Convert to Regular Skill** | Converts a Canopy skill back to plain markdown |
| **Help** | Lists all available agent operations |

### Scaffold — manual authoring (`Canopy Template` category)

For authors who know the framework and prefer to hand-write skills and resources. Each command drops a correctly-structured blank file at the right path — you fill in the content.

| Command | Description |
|---|---|
| **New Skill** | Creates `SKILL.md` + `ops.md` for a new skill |
| **New Verify File** | Scaffolds a `verify/` checklist |
| **New Template** | Scaffolds a `templates/` file (`.md`, `.yaml`, or `.yaml.gotmpl`) |
| **New Constants File** | Scaffolds a `constants/` lookup file |
| **New Policy File** | Scaffolds a `policies/` rule file |
| **New Commands File** | Scaffolds a `commands/` script (`.ps1` or `.sh`) |
| **New Schema** | Scaffolds a `schemas/` file |

## Features

### Syntax highlighting

Five language IDs cover all Canopy file types:

| Language | Files | Highlights |
|---|---|---|
| `canopy` | `SKILL.md`, `ops.md` | Tree notation, `IF`/`ELSE`/`SWITCH`/`CASE`/`DEFAULT`/`FOR_EACH`/`BREAK`/`END`, `ASK`/`SHOW_PLAN`/`VERIFY_EXPECTED`/`EXPLORE`, `<<`/`>>`, op names, binding expressions |
| `canopy-verify` | `verify/*.md`, `checklists/*.md` | Checkbox items |
| `canopy-template` | `templates/*.md`, `templates/*.yaml` | `<token>` placeholders |
| `canopy-resource` | `constants/*.md`, `policies/*.md`, `schemas/*.md`, `references/*.md` | Tables, numbered rules |
| `canopy-commands` | `commands/*.ps1`, `commands/*.sh` | `# === Section Name ===` headers |

All patterns cover both `.claude/` (Claude Code) and `.github/` (GitHub Copilot) targets.

### IntelliSense

Completions in `SKILL.md` and `ops.md`:

| Completion | What it suggests |
|---|---|
| Op names | Ops from the current skill, project-level ops, and framework primitives; inserts the correct tree-node prefix (`* ` / `├── `) automatically |
| Primitives | All framework built-ins with descriptions |
| Frontmatter | `name`, `description`, `argument-hint`, `license`, `metadata`, `allowed-tools`, `user-invocable` (full agentskills.io spec) |
| Category resources | ``Read `category/path` `` directives for `constants/`, `policies/`, `templates/`, `schemas/`, `checklists/`, `verify/`, `references/` |

### Hover documentation

Hovering over a framework primitive or a custom op shows its description, expected `<<` input and `>>` output, and a usage example.

### Go-to-definition

Press `F12` (or right-click → Go to Definition) on any `ALL_CAPS` identifier. The extension resolves through:

1. Current skill's `ops.md`
2. Consumer-defined cross-skill ops (if any)
3. Framework primitives (statically defined in the extension; defined in canopy at `skills/canopy-runtime/references/framework-ops.md`)

### Semantic diagnostics

Real-time squiggles for:

| Check | Catches |
|---|---|
| Frontmatter | Missing `name` or `description`, empty values, unknown keys |
| Tree syntax | `>>` before `<<`, empty operator slots |
| Primitive signatures | `IF`/`ELSE_IF` without `<<`; `ASK` without `\|` options; `SHOW_PLAN` without `>>`; `VERIFY_EXPECTED` wrong path prefix; `ELSE`/`BREAK` with spurious operators; `EXPLORE` without `>>` |
| Resource references | ``Read `category/path` `` uses a recognised category and the file exists on disk; `VERIFY_EXPECTED` target file existence |
| Unknown ops | Configurable severity for `ALL_CAPS` names not found in any registry |
| Op conformance hints | Tree node's `<<`/`>>` usage doesn't match the op's declared signature |

## Requirements

- VS Code 1.85 or later
- For **Install (via install script)**: `git` in PATH
- For **Install as Agent Skill (gh skill)**: `gh` CLI v2.90.0+ in PATH (the `skill` subcommand)
- For **Canopy Skill** commands targeting Claude: `claude` CLI in PATH (each command surfaces an "open download" link if missing)

## Settings

| Setting | Default | Description |
|---|---|---|
| `canopy.frameworkUrl` | `https://github.com/kostiantyn-matsebora/claude-canopy` | Framework repo URL used by install commands |
| `canopy.validate.enabled` | `true` | Enable/disable all real-time validation |
| `canopy.validate.unknownOps` | `"warning"` | Severity for unresolved op names: `error`, `warning`, `hint`, `none` |
| `canopy.validate.opConformance` | `true` | Show hints when `<<`/`>>` usage doesn't match the op's declared signature |

## Building from source

```bash
npm install
npm run compile      # one-shot TypeScript compile
npm run watch        # watch mode
npm run package      # produces canopy-skills-<version>.vsix
```

Press `F5` in VS Code to open an Extension Development Host with the extension loaded.

## Links

- [Canopy framework](https://github.com/kostiantyn-matsebora/claude-canopy)
- [Extension source](https://github.com/kostiantyn-matsebora/claude-canopy-vscode)
- [Changelog](CHANGELOG.md)
