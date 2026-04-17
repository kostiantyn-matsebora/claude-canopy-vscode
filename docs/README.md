# Canopy Skills — VS Code Extension

Language support for the [Canopy framework](https://github.com/kostiantyn-matsebora/claude-canopy): syntax highlighting, IntelliSense, diagnostics, go-to-definition, and command palette integration for `skill.md` and `ops.md` files.

## Features

### Language support
- Syntax highlighting for Canopy tree notation (`├──`, `IF`/`ELSE_IF`/`ELSE`, `<<`/`>>`, `|`)
- IntelliSense completions for op names, control-flow keywords, and category resource directives
- Hover docs for known op names
- Go-to-definition for `ALL_CAPS` op identifiers (resolves through skill-local → project → framework ops lookup order)
- Real-time diagnostics for unknown ops and structural issues

### Setup commands (`Canopy` category)

| Command | Description |
|---|---|
| **Add as submodule** | Adds Canopy as a git submodule; prompts for **Claude** (`.claude/canopy`, runs `setup.ps1/sh`) or **GitHub Copilot** (`.github/canopy`, creates junctions + stubs) |
| **Add as copy (minimal files)** | Shallow-clones Canopy and copies only the needed files; prompts for **Claude** (`.claude/`) or **GitHub Copilot** (`.github/`) |

### Scaffold commands (`Canopy` category)

| Command | Description |
|---|---|
| **New Skill** | Creates `skill.md` + `ops.md` for a new skill |
| **New Verify File** | Scaffolds a `verify/` checklist file |
| **New Template** | Scaffolds a `templates/` file (`.md`, `.yaml`, or `.yaml.gotmpl`) |
| **New Constants File** | Scaffolds a `constants/` lookup file |
| **New Policy File** | Scaffolds a `policies/` rule file |
| **New Commands File** | Scaffolds a `commands/` script (`.ps1` or `.sh`) |
| **New Schema** | Scaffolds a `schemas/` file (explore schema or custom) |

### Agent commands (`Canopy Agent` category)

All agent commands automatically detect which AI tool has Canopy installed (checks for `skills/shared/framework/ops.md` under `.claude/` or `.github/`) and invoke the appropriate CLI:
- **Claude**: `claude "<prompt>"`
- **GitHub Copilot**: `gh copilot suggest "<prompt>"`

| Command | Description |
|---|---|
| **Create Skill** | Prompts for a description, creates a new skill |
| **Modify Skill** | Picks an existing skill, prompts for the change |
| **Scaffold Skill** | Prompts for a kebab-case name, scaffolds a blank skill |
| **Convert to Canopy** | Converts an existing skill to Canopy tree format |
| **Validate Skill** | Validates a skill against framework rules |
| **Improve Skill** | Aligns a skill with the latest framework rules |
| **Advise** | Asks the agent a Canopy design question |
| **Refactor Skills** | Extracts common ops and resources across skills |
| **Convert to Regular Skill** | Converts a Canopy skill back to plain markdown |
| **Help** | Lists all agent operations |

## Requirements

- VS Code 1.85 or later
- For **Add as submodule** / **Add as copy**: `git` available in PATH
- For **Canopy Agent** commands: `claude` CLI (Claude Code) or `gh` CLI with Copilot extension installed

## Extension settings

| Setting | Default | Description |
|---|---|---|
| `canopy.frameworkUrl` | `https://github.com/kostiantyn-matsebora/claude-canopy` | Git URL used by the setup commands |
| `canopy.validate.enabled` | `true` | Enable real-time validation |
| `canopy.validate.unknownOps` | `warning` | Severity for unresolved `ALL_CAPS` op names (`error`, `warning`, `hint`, `none`) |

## Installation

Install from the VS Code marketplace or from a `.vsix` file:

```
code --install-extension canopy-skills-<version>.vsix
```

## Building from source

```bash
npm install
npm run compile     # one-shot TypeScript compile
npm run watch       # watch mode
npm run package     # produces canopy-skills-<version>.vsix
```

Press `F5` in VS Code to launch an Extension Development Host.
