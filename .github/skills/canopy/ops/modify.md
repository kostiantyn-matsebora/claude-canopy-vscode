# MODIFY

Make targeted changes to an existing Canopy skill.

1. Locate the skill directory using Glob.
2. Read all files: `SKILL.md`, `ops.md` (if present), and all category subdir files.
3. Understand the requested changes.
4. Present a decision table before making any changes:

   | Item | File | Change | Reason |
   |------|------|--------|--------|
   | `<symbol or section>` | `<file>` | `<what will change>` | `<why>` |

   Then list: new files to create | files to delete (if any). Then emit an apply block per `constants/apply-block-protocol.md` with fields: `op: MODIFY` | `skill: <name>` | `changes`.

5. Ask: **"Proceed? | Yes | Adjust | No"** — wait for response before touching any file.
6. Apply changes:
   - Read `policies/preservation-rules.md` before making any edits
   - Edit `SKILL.md` and/or `ops.md` as needed
   - Create, edit, or remove category files as needed
7. Verify result against `verify/modify-expected.md`.
8. Report: **Summary / Files changed**
