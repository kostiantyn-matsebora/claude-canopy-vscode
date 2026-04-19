# ADVISE

Answer a "how to" question about implementing something in an existing Canopy skill. Read-only — no files are written. Produces a structured plan the user can hand to MODIFY or IMPROVE.

1. If no skill name or path is given, ask for it.
2. Locate the skill directory using Glob.
3. Read all files: `skill.md`, `ops.md` (if present), and all category subdir files.
4. Understand the question — identify the specific behaviour, pattern, or feature being asked about.
5. Analyse the current skill against the question:
   - Identify what is missing, suboptimal, or not yet expressed in the skill
   - Determine which framework primitives, ops, or category files apply
   - Identify which existing nodes or ops need to change and which new ones are needed
6. Present an advice plan as a table:

   | # | What | File | Action | Reasoning |
   |---|------|------|--------|-----------|
   | 1 | `<symbol, section, or content>` | `<file>` | add / change / extract / create | `<why this is the right Canopy approach>` |

   Follow the table with a short explanation of the overall approach and any trade-offs.
7. Do not apply any changes. If the user wants the changes applied, tell them to follow up with MODIFY or IMPROVE.
8. Report: **Advice plan / Approach summary / Suggested follow-up operation**
