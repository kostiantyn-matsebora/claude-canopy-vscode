# Canopy Skills — VS Code Extension

Language support for [Canopy](https://github.com/kostiantyn-matsebora/claude-canopy): syntax highlighting, IntelliSense, semantic diagnostics, go-to-definition, scaffold commands, and AI agent integration for Canopy skill files.

---

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

- **Skills** (`skill.md`) define behavior as a tree of operation calls.
- **Ops** (`ops.md`) define reusable named operations local to a skill or shared across skills.
- **Framework primitives** (`IF`, `ELSE_IF`, `ELSE`, `BREAK`, `ASK`, `VERIFY_EXPECTED`, `EXPLORE`, `SHOW_PLAN`, …) are built-in control-flow ops provided by the framework.
- **Resources** (constants, policies, templates, schemas, verify checklists, command scripts) are supporting files co-located with each skill.
- Skills can target **Claude Code** (`.claude/skills/`) or **GitHub Copilot** (`.github/skills/`).

Canopy turns AI instructions into something you can read, review, version-control, lint, and refactor — like real code.

---

## What this extension does

This extension brings first-class editor support for Canopy files to VS Code:

- **Syntax highlighting** for all Canopy file types
- **IntelliSense** — op name completions, control-flow keywords, category resource directives, frontmatter keys
- **Hover documentation** for framework primitives and custom ops
- **Go-to-definition** for `ALL_CAPS` op identifiers — navigates through skill-local → project → framework lookup order
- **Semantic diagnostics** — real-time validation beyond syntax: required frontmatter fields, tree node structure, primitive signature conformance, resource reference existence, custom op conformance
- **Scaffold commands** — create new skills, ops files, verify checklists, templates, constants, policies, schemas, and command scripts with correct structure
- **Setup commands** — add Canopy to a project as a git submodule or a minimal file copy, for both Claude and Copilot targets
- **Agent commands** — invoke the Canopy AI agent (via `claude` or `gh copilot suggest`) directly from the command palette to create, validate, improve, or convert skills

---

## Features

### Syntax highlighting

Five language IDs cover all Canopy file types:

| Language | Files | Highlights |
|---|---|---|
| `canopy` | `skill.md`, `ops.md` | Tree notation, `IF`/`ELSE`, `<<`/`>>`, op names, binding expressions |
| `canopy-verify` | `verify/*.md`, `checklists/*.md` | Checkbox items |
| `canopy-template` | `templates/*.md`, `templates/*.yaml` | `<token>` placeholders |
| `canopy-resource` | `constants/*.md`, `policies/*.md`, `schemas/*.md` | Tables, numbered rules |
| `canopy-commands` | `commands/*.ps1`, `commands/*.sh` | `# === Section Name ===` headers |

All patterns cover both `.claude/` (Claude Code) and `.github/` (GitHub Copilot) targets.

### IntelliSense

In `skill.md` and `ops.md` files:

- **Op name completions** — suggests ops from the current skill, project-level ops, and framework primitives; inserts the correct tree-node prefix (`* ` or `├── `) automatically
- **Primitive completions** — all framework built-ins with descriptions
- **Frontmatter completions** — `name`, `description`, and other known keys
- **Category resource completions** — `Read \`category/path\`` directives for constants, policies, templates, schemas, and verify files

### Hover documentation

Hovering over a framework primitive or a custom op shows its description, expected `<<` input and `>>` output, and a usage example.

### Go-to-definition

Press `F12` (or right-click → Go to Definition) on any `ALL_CAPS` identifier. The extension resolves through:

1. Current skill's `ops.md`
2. Project-level `ops.md` files
3. Framework `skills/shared/framework/ops.md`

### Semantic diagnostics

Real-time squiggles for:

- **Frontmatter** — missing `name` or `description`, empty values, unknown keys
- **Tree syntax** — `>>` appearing before `<<`, empty operator slots
- **Primitive signatures** — `IF`/`ELSE_IF` without `<<`; `ASK` without `|` options; `SHOW_PLAN` without `>>`; `VERIFY_EXPECTED` wrong path prefix; `ELSE`/`BREAK` with spurious operators; `EXPLORE` without `>>`
- **Resource references** — `Read \`category/path\`` uses a recognised category and the file exists on disk; `VERIFY_EXPECTED` target file existence
- **Unknown ops** — configurable severity for `ALL_CAPS` names not found in any registry
- **Op conformance hints** — warns when a tree node's `<<`/`>>` usage doesn't match the op's declared signature

---

## Commands

All commands are accessible via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### Setup (`Canopy` category)

| Command | Description |
|---|---|
| **Add as submodule** | Adds Canopy as a git submodule; prompts for Claude (`.claude/`) or Copilot (`.github/`) target |
| **Add as copy (minimal files)** | Shallow-clones Canopy and copies the minimum required files; same target prompt |

### Scaffold (`Canopy` category)

| Command | Description |
|---|---|
| **New Skill** | Creates `skill.md` + `ops.md` for a new skill |
| **New Verify File** | Scaffolds a `verify/` checklist |
| **New Template** | Scaffolds a `templates/` file (`.md`, `.yaml`, or `.yaml.gotmpl`) |
| **New Constants File** | Scaffolds a `constants/` lookup file |
| **New Policy File** | Scaffolds a `policies/` rule file |
| **New Commands File** | Scaffolds a `commands/` script (`.ps1` or `.sh`) |
| **New Schema** | Scaffolds a `schemas/` file |

### Agent (`Canopy Agent` category)

All agent commands auto-detect the installed AI target (checks for `skills/shared/framework/ops.md` under `.claude/` or `.github/`) and invoke the matching CLI:

- **Claude Code**: `claude "<prompt>"`
- **GitHub Copilot**: `gh copilot suggest "<prompt>"`

| Command | Description |
|---|---|
| **Create Skill** | Describe a skill; the agent writes it |
| **Modify Skill** | Pick a skill and describe the change |
| **Scaffold Skill** | Provide a name; the agent creates the blank structure |
| **Convert to Canopy** | Converts a plain-markdown skill to Canopy tree format |
| **Validate Skill** | Checks a skill against all framework rules |
| **Improve Skill** | Aligns a skill with the latest framework conventions |
| **Advise** | Ask the agent a design question about Canopy |
| **Refactor Skills** | Extracts shared ops and resources across multiple skills |
| **Convert to Regular Skill** | Converts a Canopy skill back to plain markdown |
| **Help** | Lists all available agent operations |

---

## Requirements

- VS Code 1.85 or later
- For **Add as submodule** / **Add as copy**: `git` in PATH
- For **Canopy Agent** commands: `claude` CLI (Claude Code) **or** `gh` CLI with the Copilot extension

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `canopy.frameworkUrl` | `https://github.com/kostiantyn-matsebora/claude-canopy` | Framework repo URL used by setup commands |
| `canopy.validate.enabled` | `true` | Enable/disable all real-time validation |
| `canopy.validate.unknownOps` | `"warning"` | Severity for unresolved op names: `error`, `warning`, `hint`, `none` |
| `canopy.validate.opConformance` | `true` | Show hints when `<<`/`>>` usage doesn't match the op's declared signature |

---

## Installation

Install from the VS Code Marketplace, or from a `.vsix` file:

```bash
code --install-extension canopy-skills-<version>.vsix
```

## Building from source

```bash
npm install
npm run compile      # one-shot TypeScript compile
npm run watch        # watch mode
npm run package      # produces canopy-skills-<version>.vsix
```

Press `F5` in VS Code to open an Extension Development Host with the extension loaded.

---

## Links

- [Canopy framework](https://github.com/kostiantyn-matsebora/claude-canopy)
- [Extension source](https://github.com/kostiantyn-matsebora/claude-canopy-vscode)
- [Changelog](CHANGELOG.md)
