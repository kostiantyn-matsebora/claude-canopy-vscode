# Canopy <img src="../assets/icons/logo-ai-skills.svg" align="right" width="60%" />

**AI skills as executable code, not prose.**



AI skills written as prose are instructions. Instructions get interpreted. Interpretations
drift. When a skill fails, you're re-reading sentences trying to figure out which one was
misunderstood. When it works, you're not entirely sure why it did.

**Canopy makes skills programs.**

---
## Why Canopy?

* **Skills that run the same way twice.** Your skill always runs the same way. Not because you wrote
  better prose, but because the tree is explicit. The model follows what you defined.

* **Operations you write once and reuse everywhere.** Define `DEPLOY`, `VERIFY`, or `ROLLBACK` once in `ops.md`. Every
  skill that needs it shares the same definition. Update one place; all skills stay in sync.

* **Execution you can read before it runs.** The tree shows exactly what will happen—and in what order—
  before any action touches your project.

* **Resources you can navigate without reading prose.** Schemas, templates, commands, constants, and checklists live in
  organized directories. No hunting through prose. Find what you need. Reuse instantly.

* **Failures you can trace to a single node.** When a skill misbehaves, the tree tells you exactly
  where it went wrong. No re-reading prose. Use `/canopy-debug <skill>` to replay any skill with
  live phase banners and per-node tracing — pin the failing node, fix its op definition, move on.

* **Skills that run on Claude Code and GitHub Copilot.** Write a skill once; the Canopy interpreter
  detects your platform at execution time and adapts — native subagents on Claude Code, inline
  fallback on Copilot. The same `skill.md` works on both without modification.

* **No framework to learn to get started.** Tell `canopy` what you need. It scaffolds, validates,
  and converts skills for you. No learning curve.

## How it works

> The tree is the source of truth. The platform is just a detail.

Every Canopy skill is a `skill.md` file — platform-agnostic by design. When a skill runs, the `canopy` agent detects whether you're on Claude Code or GitHub Copilot, loads the matching runtime spec, then executes the tree using platform-appropriate primitives. The same skill file works on both platforms without modification.

The `canopy` agent itself is a Canopy skill: its `## Agent` section classifies your intent and detects the platform; its `## Tree` routes to the correct operation via an explicit `IF/ELSE_IF` chain — no LLM-inferred dispatch.

Here's a complete skill — frontmatter, execution tree, and all:

```markdown
---
name: release
description: Bump version across files and update changelog.
argument-hint: "[major|minor|patch]"
---

Parse `$ARGUMENTS` to determine version bump strategy.

---

## Agent

**explore** — reads the project structure: current version in package.json,
pyproject.toml, and other version-bearing files; lists all files needing updates.

---

## Tree

* release
  * EXPLORE >> current_version | version_files
  * SHOW_PLAN >> new_version | files | changelog
  * ASK << Proceed? | Yes | No
  * IF << Yes
    * BUMP_FILES << version_files | new_version
    * IF << CHANGELOG.md exists
      * ADD_CHANGELOG_ENTRY << new_version
    * VERIFY_EXPECTED << verify/verify-expected.md
  * ELSE
    * natural language: Cancelled by user.

## Rules

* Never overwrite version files without confirmation via `SHOW_PLAN` and `ASK`.
* Verify all files were updated before responding.
```

> 
> Seven nodes, reusable op definitions, real-state evaluation, and guardrails to prevent mistakes - this is **Canopy** in action.

## Examples and Resources

**Examples:** [claude-canopy-examples](https://github.com/kostiantyn-matsebora/claude-canopy-examples) — a working project to learn from.

**Workflow:** [FRAMEWORK.md](FRAMEWORK.md#workflow-diagram) explains the full execution pipeline.



## Quick Start

### Option A - Installer (simplest)

One command installs the latest release and wires Claude Code. Re-run with a version tag to update.

```bash
# Linux / macOS
curl -sSL https://raw.githubusercontent.com/kostiantyn-matsebora/claude-canopy/main/install.sh | bash

# Install a specific version
curl -sSL https://raw.githubusercontent.com/kostiantyn-matsebora/claude-canopy/main/install.sh | bash -s -- v1.0.0

# Windows
irm https://raw.githubusercontent.com/kostiantyn-matsebora/claude-canopy/main/install.ps1 | iex
```

The installer writes a `.canopy-version` file at the project root. Commit it so collaborators know which version to reinstall on a fresh clone. Update Canopy by re-running the installer with the new version tag.

> **Do not use `git clone` here.** That creates a nested `.git` repo — your project's git will not track any files inside `.claude/`, including your own skills.

### Option B - Git Submodule (recommended)

Keeps Canopy as a versioned dependency. Your skills live in your repo; Canopy lives in the submodule. Update Canopy anytime with `git submodule update --remote`.

```bash
# 1. Add the submodule
git submodule add https://github.com/kostiantyn-matsebora/claude-canopy .claude/canopy

# 2. Run the setup script to wire Claude Code to both canopy internals and your skills
bash .claude/canopy/setup.sh        # Linux / macOS
pwsh .claude/canopy/setup.ps1       # Windows

# 3. Remove the Canopy repo's CLAUDE.md — it lives inside the submodule and is not
#    auto-loaded by Claude Code, but deleting it keeps .claude/canopy/ uncluttered
rm .claude/canopy/CLAUDE.md
```

The setup script creates files and links in your project (outside the submodule):

```text
.claude/
├── canopy/                          <- git submodule (never edit here)
├── agents/
│   ├── canopy.md                    <- symlinked from canopy; bundled agent
│   └── canopy/                      <- symlinked from canopy; agent resources
├── rules/
│   └── skill-resources.md           <- created by setup; globs cover both dirs
└── skills/
    ├── shared/
    │   ├── project/ops.md           <- created by setup; add your project-wide ops here
    │   └── ops.md                   <- created by setup; redirect stub
    └── <your-skill>/                <- your skills, tracked in your project repo
```

The script is idempotent - safe to re-run, never overwrites existing files.

### Option C - Git Subtree (recommended for teams)

Files live directly in your repo history — no extra clone steps, no submodule complexity. On Unix/macOS, commit the generated symlinks once; collaborators get a working setup on `git clone` with no extra steps.

```bash
# 1. Add Canopy as a subtree
git subtree add --prefix=.claude/canopy \
  https://github.com/kostiantyn-matsebora/claude-canopy main --squash

# 2. Wire Claude Code (creates relative symlinks + config stubs)
bash .claude/canopy/setup.sh        # Linux / macOS
pwsh .claude/canopy/setup.ps1       # Windows

# 3. On Unix/macOS: commit the symlinks — collaborators get them on git clone
git add .claude/skills .claude/agents .claude/rules
git commit -m "chore: add Canopy via subtree and wire symlinks"
```

Update Canopy later — no need to re-run setup:

```bash
git subtree pull --prefix=.claude/canopy \
  https://github.com/kostiantyn-matsebora/claude-canopy main --squash
```

> Compared to submodule: subtree squashes Canopy commits into your repo history (no `.gitmodules`, no `--recurse-submodules` on clone). Compared to installer: files are versioned in git, so `git log .claude/canopy/` shows what changed.

---

## Usage

### Using the `canopy` Agent

The `canopy` agent handles the full skill lifecycle.

**Claude Code** — use the `/canopy` slash command (shortest form):

```
/canopy create a skill that bumps semantic versions across project files
/canopy validate the bump-version skill
```

Or the explicit form if the slash command is unavailable:

```
Follow .claude/agents/canopy.md and create a skill that bumps semantic versions
```

**GitHub Copilot:**

```
Follow .github/agents/canopy.md and create a skill that bumps semantic versions
```

| Operation | What to say |
|-----------|-------------|
| **Create** | "Create a canopy skill that bumps semantic versions across project files" |
| **Modify** | "Add a dry-run option to the deploy-service skill" |
| **Scaffold** | "Scaffold a blank skill called api-docs" |
| **Convert to Canopy** | "Convert my old deploy.md skill to canopy format" |
| **Validate** | "Validate the bump-version skill" |
| **Improve** | "Improve the deploy-service skill" |
| **Advise** | "How should I add a verify step to the review-api skill?" |
| **Refactor skills** | "Refactor skills — extract shared ops" |
| **Convert to regular** | "Convert the review-file skill back to a plain skill" |
| **Help** | "What can the canopy agent do?" |

For **Create** and **Scaffold**, the agent asks your preferred tree syntax - **markdown list** (`*` nested bullets) or **box-drawing** (fenced tree characters) - before writing anything.

Every operation shows a plan and asks for confirmation before making changes.

### Using the `canopy-help` Skill

`canopy-help` is a lightweight read-only skill that emits the canopy agent reference without invoking the agent itself. Use it when you just want to browse the operations list or look up a specific procedure.

```
/canopy-help
/canopy-help improve
/canopy-help refactor-skills
```

With no argument it prints the full operations reference. With an operation name it prints that operation's procedure verbatim.

### Writing a Skill Manually

See [AUTHORING.md](AUTHORING.md) for the full manual reference - skill anatomy, tree syntax, op definitions, category resource conventions, and what `skill.md` must not contain.

---

For detailed directory layout and structure (standalone vs. submodule), see [FRAMEWORK.md](FRAMEWORK.md#directory-layout).

---

## Under the Hood

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  my-skill/skill.md                                                         │
│                                                                            │
│  Stage 1: Initialize context                                               │
│  ┌─ Frontmatter + Preamble ───────────────────────────────────────────┐    │
│  │  name, description, argument-hint                                  │    │
│  │  parse $ARGUMENTS, set context variables                           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │                                               │
│                            ▼                                               │
│  Stage 2: Detect platform + load runtime                                   │
│  ┌─ canopy agent (## Tree, first steps) ─────────────────────────────┐    │
│  │  detect platform: .claude/ -> Claude Code | .github/ -> Copilot   │    │
│  │  load runtimes/claude.md  or  runtimes/copilot.md                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │                                               │
│                            ▼                                               │
│  Stage 3: Explore (optional)                                               │
│  ┌─ ## Agent: explore ────────────────────────────────────────────────┐    │
│  │  Claude Code: run native explore subagent                          │    │
│  │  Copilot:     inline sequential file reading (fallback)            │    │
│  │  capture schemas/explore-schema.json output into context           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │                                               │
│                            ▼                                               │
│  Stage 4: Plan and confirmation gate                                       │
│  ┌─ ## Tree entry steps ──────────────────────────────────────────────┐    │
│  │  SHOW_PLAN >> fields                                               │    │
│  │  ASK << Proceed? | Yes | No                                        │    │
│  │  No -> stop without changes                                        │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │ Yes                                           │
│                            ▼                                               │
│  Stage 5: Execute workflow actions (iterative loop)                        │
│  ┌─ ## Tree action steps ─────────────────────────────────────────────┐    │
│  │  run op calls + natural-language nodes top-to-bottom               │    │
│  │  evaluate IF / ELSE_IF / ELSE branches                             │    │
│  │  repeat until no remaining actions                                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │                                               │
│                            ▼                                               │
│  Stage 6: Verify expected outcomes                                         │
│  ┌─ VERIFY_EXPECTED ──────────────────────────────────────────────────┐    │
│  │  compare resulting state against verify checklist                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│  ┌─ ## Rules (guardrails) ────────────────────────────────────────────┐    │
│  │  • Never overwrite without confirmation                            │    │
│  │  • Always show plan before changes                                 │    │
│  │  Enforced for the full duration of skill execution                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                            │                                               │
│                            ▼                                               │
│  Stage 7: Respond                                                          │
│  ┌─ ## Response ──────────────────────────────────────────────────────┐    │
│  │  Declares output format: Summary / Changes / Notes                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

Op lookup (ALL_CAPS node -> definition):          Category resources (loaded per step):
1. my-skill/ops.md          (skill-local)         schemas/   -> subagent contracts
2. shared/project/ops.md    (project-wide)        policies/  -> active rules / guardrails
3. shared/framework/ops.md  (primitives)          templates/ -> fill <token> -> write file
   IF, ELSE, ASK, SHOW_PLAN, VERIFY...            commands/  -> run named shell section
                                                   constants/ -> load named values
                                                   verify/    -> post-run checklist

Runtime specs (loaded at Stage 2):
  runtimes/claude.md   -> .claude/ paths, native subagents, rules globs
  runtimes/copilot.md  -> .github/ paths, inline subagent fallback, copilot-instructions.md
```

---

## Contributing

Canopy is currently a personal project. Issues and PRs welcome once the API stabilizes.

- Keep `docs/FRAMEWORK.md` as the single source of truth
- `canopy` agent must be updated whenever framework rules change
- Framework primitives in `skills/shared/framework/ops.md` are immutable contracts

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and PR expectations.

---

## License

MIT - see [LICENSE](../LICENSE).
