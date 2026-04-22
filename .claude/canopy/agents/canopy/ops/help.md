# HELP

Present a concise help reference for the Canopy agent — no files are read, no changes are made.

Emit the following output exactly as structured:

---

## What is Canopy?

Canopy is a declarative, tree-structured execution framework for Claude Code skills.
A skill is a `.md` file with a `## Tree` section that defines a named pipeline of steps and named ops (`ALL_CAPS` identifiers resolved from `ops.md` files).
Resources (rules, tables, checklists, schemas) live in typed category subdirectories and are loaded at point of use — keeping each context window small.

Framework source: https://github.com/kostiantyn-matsebora/claude-canopy

---

## How to invoke the Canopy agent

### Claude Code CLI

The canopy agent is not a slash command — `/canopy` would invoke a skill, not the agent. Address Claude directly with a natural language request; the agent instructions are picked up from `.claude/agents/canopy.md` automatically:

```
improve bump-version
validate review-backend
convert list-skills to canopy
create a skill that bumps the version and updates the changelog
```

To be explicit, prefix your request with the agent path:

```
Follow .claude/agents/canopy.md and improve bump-version
```

### VS Code Copilot Chat

The canopy agent is not a registered `@participant` — it cannot be called with `@canopy`. Three options:

**Option 1 — Explicit each time** (always works):
```
Follow .github/agents/canopy.md and convert list-skills to canopy
```

**Option 2 — `/canopy` prompt file** (recommended for frequent use):
A `.github/prompts/canopy.prompt.md` file is surfaced by VS Code Copilot Chat as a `/canopy` slash command. Create it once and it acts as a shortcut that loads the agent instructions automatically.

**Option 3 — Auto-follow via repo instructions**:
Add a rule to `.github/copilot-instructions.md` with trigger phrases (e.g. `convert * to canopy`, `validate * skill`). Copilot applies the canopy agent instructions automatically when a request matches.

---

## How to use this agent

Invoke with a natural language request directed at the agent. Examples:

```
create a skill that bumps the version and updates the changelog
scaffold my-skill
convert release/SKILL.md to canopy
validate review-backend
improve review-api
help
```

The agent detects the intended operation from your words and loads only the procedure it needs.

---

## Operations

| Operation | What it does | Example invocation |
|-----------|-------------|-------------------|
| `CREATE` | Create a new Canopy skill from a description | `create a skill that ...` |
| `MODIFY` | Make targeted changes to an existing skill | `modify review-backend to also ...` |
| `SCAFFOLD` | Generate a blank skill skeleton with placeholder files | `scaffold my-new-skill` |
| `CONVERT_TO_CANOPY` | Convert a flat prose/numbered-steps skill to Canopy format | `convert release/SKILL.md to canopy` |
| `VALIDATE` | Check a skill for framework errors, warnings, and optimizations | `validate review-api` |
| `IMPROVE` | Fix violations, re-categorise misplaced resources, align with framework | `improve review-backend-architecture` |
| `ADVISE` | Answer a "how to" question about a skill — read-only, produces a plan | `how should I add a verify step to review-api?` |
| `REFACTOR_SKILLS` | Find ops/resources duplicated across > 2 skills and extract to shared | `refactor skills` |
| `CONVERT_TO_REGULAR` | Flatten a Canopy skill back to prose/numbered steps | `convert review-backend back to regular` |
| `HELP` | Show this reference | `help` or `what can you do?` |

---

## Skill anatomy (quick reference)

```
skill.md
├── --- frontmatter (name, description, argument-hint)
├── Preamble — parse $ARGUMENTS
├── ## Tree — execution pipeline (* list or box-drawing)
├── ## Rules — skill-wide invariants
└── ## Response: — output format declaration

ops.md          ← named op definitions (ALL_CAPS)
constants/      ← read-only lookup tables
checklists/     ← evaluation criteria (- [ ] items)
policies/       ← behavioural must/must-not rules
schemas/        ← data shape definitions
templates/      ← fillable output documents
commands/       ← executable scripts
verify/         ← expected-state checklists for VERIFY_EXPECTED
```

Op lookup order: `<skill>/ops.md` → `shared/project/ops.md` → `shared/framework/ops.md`
