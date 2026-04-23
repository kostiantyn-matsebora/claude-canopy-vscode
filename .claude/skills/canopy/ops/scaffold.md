# SCAFFOLD

Generate a blank skill skeleton with all directories and placeholder files.

1. If no skill name given, ask for it. Validate it is kebab-case; refuse if not.
2. Read `policies/platform-targeting.md` and resolve the target platform and skills base path. Check if `<skills_base>/<skill_name>/` already exists — if so, `END Skill already exists.`
3. Ask: **"Which tree syntax? | Markdown list (`*`) | Box-drawing (tree characters)"**
4. Show plan: skill name | files to create | directories to create. Then emit an apply block per `constants/apply-block-protocol.md` with fields: `op: SCAFFOLD` | `skill: <name>` | `tree-syntax: <markdown-list|box-drawing>` | `target-dir: <skills_base>/<name>/` | `platform: <claude|copilot>`.

5. Ask: **"Proceed? | Yes | No"**
6. Create `<skill_name>/` under `<skills_base>/` (resolved in step 2) and write:

   `SKILL.md` (markdown list variant):
   ```markdown
   ---
   name: <skill-name>
   description: <one-line description>
   argument-hint: "<required-arg> [optional-arg]"
   ---

   <Preamble: parse $ARGUMENTS and set context variables here.>

   ---

   <!-- Optional: include ## Agent when the skill needs an explore subagent.
        Pick one of the three canonical shapes (A/B/C) — see
        `policies/authoring-rules.md` → "## Agent body shape".

   ## Agent

   **explore** — <one-line task summary>. Output contract: `schemas/explore-schema.json`.
   -->

   ## Tree

   * <skill-name>
     * SHOW_PLAN >> <field1> | <field2>
     * ASK << Proceed? | Yes | No
     * <do the thing>

   ## Rules

   - <invariant that applies throughout execution>

   ## Response: Summary / Changes / Notes
   ```

   `SKILL.md` (box-drawing variant):
   ```markdown
   ---
   name: <skill-name>
   description: <one-line description>
   argument-hint: "<required-arg> [optional-arg]"
   ---

   <Preamble: parse $ARGUMENTS and set context variables here.>

   ---

   <!-- Optional: include ## Agent when the skill needs an explore subagent.
        Pick one of the three canonical shapes (A/B/C) — see
        `policies/authoring-rules.md` → "## Agent body shape".

   ## Agent

   **explore** — <one-line task summary>. Output contract: `schemas/explore-schema.json`.
   -->

   ## Tree

   \`\`\`
   <skill-name>
   ├── SHOW_PLAN >> <field1> | <field2>
   ├── ASK << Proceed? | Yes | No
   └── <do the thing>
   \`\`\`

   ## Rules

   - <invariant that applies throughout execution>

   ## Response: Summary / Changes / Notes
   ```

   `ops.md`:
   ```markdown
   # <skill-name> — Local Ops

   ---

   ## MY_OP << input >> output

   <Description of what this op does.>

   * MY_OP << input >> output
     * IF << condition
       * branch action
     * ELSE
       * other action
   ```

7. Create subdirectories: `schemas/`, `policies/`, `checklists/`, `templates/`, `constants/`, `commands/`, `verify/`
8. Verify result against `verify/scaffold-expected.md`.
9. Report: **Summary / Files created / Next steps**
