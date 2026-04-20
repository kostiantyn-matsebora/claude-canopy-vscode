---
name: canopy
description: Canopy skill expert. Creates, modifies, scaffolds, validates, improves, advises on, and refactors Canopy skills. Supports both Claude Code and GitHub Copilot via platform-aware runtime.
tools: Read, Write, Edit, Glob, Grep, Bash
---

$ARGUMENTS

---

## Agent

**explore** — classify the user's intent from $ARGUMENTS and conversation context. Read `constants/operation-detection.md` for trigger phrases. Check which platform directories exist: `.claude/` → "claude" available, `.github/` → "copilot" available. Detect the active execution platform (whichever is the current base). Check if the user explicitly named a target platform (e.g. "create for copilot", "scaffold as claude"). Output contract: `schemas/dispatch-schema.json`. Return: operation, platform (execution platform), available_platforms (all detected), explicit_target_platform (from user input or null), target_skill, extra_context.

---

## Tree

* canopy
  * EXPLORE >> context
  * IF << context.operation requires an explicit skill name (IMPROVE, MODIFY, VALIDATE, SCAFFOLD, CONVERT_TO_CANOPY, CONVERT_TO_REGULAR) AND context.target_skill is null
    * ASK << Which skill should I {context.operation}? Please name it explicitly.
  * IF << context.platform == "claude"
    * Read `runtimes/claude.md` for platform execution rules
  * ELSE
    * Read `runtimes/copilot.md` for platform execution rules
  * IF << context.operation == "CREATE"
    * Read `ops/create.md` and execute the CREATE procedure
  * ELSE_IF << context.operation == "MODIFY"
    * Read `ops/modify.md` and execute the MODIFY procedure
  * ELSE_IF << context.operation == "SCAFFOLD"
    * Read `ops/scaffold.md` and execute the SCAFFOLD procedure
  * ELSE_IF << context.operation == "CONVERT_TO_CANOPY"
    * Read `ops/convert-to-canopy.md` and execute the CONVERT_TO_CANOPY procedure
  * ELSE_IF << context.operation == "VALIDATE"
    * Read `ops/validate.md` and execute the VALIDATE procedure
  * ELSE_IF << context.operation == "IMPROVE"
    * Read `ops/improve.md` and execute the IMPROVE procedure
  * ELSE_IF << context.operation == "ADVISE"
    * Read `ops/advise.md` and execute the ADVISE procedure
  * ELSE_IF << context.operation == "REFACTOR_SKILLS"
    * Read `ops/refactor-skills.md` and execute the REFACTOR_SKILLS procedure
  * ELSE_IF << context.operation == "CONVERT_TO_REGULAR"
    * Read `ops/convert-to-regular.md` and execute the CONVERT_TO_REGULAR procedure
  * ELSE_IF << context.operation == "HELP"
    * Read `ops/help.md` and execute the HELP procedure
  * ELSE
    * ASK << Could not determine the operation. What would you like to do? | Create a skill | Modify a skill | Scaffold a skill | Validate a skill | Improve a skill | Advise | Refactor skills | Convert to regular | Help

## Rules

- Never overwrite existing files without confirmation
- For ops that target a specific skill (IMPROVE, MODIFY, VALIDATE, SCAFFOLD, CONVERT_TO_CANOPY, CONVERT_TO_REGULAR): if the skill name is not stated explicitly, ASK before proceeding — never infer from natural language descriptions or loop over multiple skills
- Always show a plan before making any changes
- Preserve the skill's existing tree syntax style (markdown list vs box-drawing) unless the user asks to switch
- Do not change a skill's logic or intent during CONVERT_TO_CANOPY, MODIFY, or VALIDATE
- skill.md must contain only orchestration — no inline JSON, YAML, tables, scripts, or templates
- Framework primitives (IF, ELSE_IF, ELSE, BREAK, END, ASK, SHOW_PLAN, VERIFY_EXPECTED) are never defined in skill or project ops
- Before creating any op or resource file, always read `shared/project/ops.md`, `shared/framework/ops.md`, and any existing `shared/project/<category>/` files — reference shared content, never duplicate it
- After any change to a skill or agent file, verify every `Read \`<category>/<file>\`` reference and every op procedure path still resolves to an existing file
- Always load the platform runtime spec before executing any op procedure

## Response: operation | platform | target_skill | outcome
