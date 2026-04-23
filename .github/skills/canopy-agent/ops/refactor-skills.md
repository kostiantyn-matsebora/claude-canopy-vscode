# REFACTOR_SKILLS

Analyse all available Canopy skills, identify ops and resources duplicated across more than two skills, and extract them to the appropriate `shared/` location. Logic and intent of all skills are preserved; only shared content is lifted out and references updated.

1. Discover all skill directories using Glob:
   - `.claude/skills/*/SKILL.md` and `.claude/skills/*/ops.md`
   - `.github/skills/*/SKILL.md` and `.github/skills/*/ops.md`
   Collect every unique skill name. For each skill, also list category subdir files (`constants/`, `policies/`, `checklists/`, `schemas/`, `verify/`, `templates/`, `commands/`, `references/`).

2. Read all discovered files. Build an inventory:

   **Op inventory** — for each `ALL_CAPS` op name defined in any `ops.md`:
   | Op name | Skills it appears in | Definition summary |
   |---------|---------------------|--------------------|

   **Resource inventory** — for each category file in any skill:
   | File | Skills it appears in | Category | Content summary |
   |------|---------------------|----------|-----------------|

3. Identify extraction candidates — items that appear in **more than two** skills:

   **Op candidates**: ops with the same name, OR semantically identical logic under different names, across > 2 skills. Exclude framework primitives.

   **Resource candidates**: category files with identical or near-identical content across > 2 skills. Only extract when the content's meaning is independent of the source skill's context.

   Determine the correct shared target for each candidate. There is no built-in shared location in the new agentskills.io layout; ASK the user where to extract:
   - A new dedicated skill (recommended): `<consumer-shared-skill>/ops.md` and `<consumer-shared-skill>/<category>/<filename>` — apply `policies/category-decision-flowchart.md` to confirm the right category
   - An existing consumer-shared skill they already have

4. Read `references/framework-ops.md` (framework primitives) and any consumer-shared skill files the user names to confirm no candidate is already defined there.

5. Present a decision table before making any changes:

   | # | Content | Current location(s) | Target | Action | Reason |
   |---|---------|---------------------|--------|--------|--------|
   | 1 | `<op name or resource description>` | `skill-a/ops.md`, `skill-b/ops.md`, `skill-c/ops.md` | `<consumer-shared-skill>/ops.md` | extract + update refs | duplicated in N > 2 skills |

   Then list: skills whose `ops.md` or `SKILL.md` will be updated | new shared files to create.

   If no extraction candidates are found, report that and stop.

   Then emit an apply block per `constants/apply-block-protocol.md` with fields: `op: REFACTOR_SKILLS` | `changes`.

6. Ask: **"Proceed? | Yes | Adjust | No"** — wait for response before touching any file.

7. Apply all changes:
   - Read `policies/preservation-rules.md` before modifying any skill
   - Append extracted ops to the consumer-shared skill's `ops.md`; preserve all existing content
   - Write extracted resource files to `<consumer-shared-skill>/<category>/`
   - In each source skill's `ops.md`: remove the extracted op definition verbatim; if the file becomes empty, delete it
   - In each source skill's `SKILL.md` or `ops.md`: update every `Read \`<category>/<file>\`` reference to point to the new shared path
   - Do not change any other tree structure, logic, or intent
   - Do not merge ops that share a name but have meaningfully different behaviour — flag those as conflicts instead

8. Run VALIDATE inline on each modified skill. Fix any issues introduced by the refactor before reporting.
9. Verify result against `verify/refactor-skills-expected.md`.
10. Report: **Summary / Ops extracted / Resources extracted / Skills updated / Conflicts skipped / Validation results**
