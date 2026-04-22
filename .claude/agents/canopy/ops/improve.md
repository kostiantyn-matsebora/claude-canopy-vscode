# IMPROVE

Align an existing Canopy skill with the current Canopy framework rules — fix structural violations, re-categorise misplaced resources, and extract any remaining inline content. Logic and intent are preserved; only structure and resource placement change.

1. Locate the skill directory using Glob.
2. Read all files: `skill.md`, `ops.md` (if present), and all category subdir files.
3. Run VALIDATE inline to collect all Errors, Warnings, and Optimizations. Record as `validate_findings`.
4. Read `shared/project/ops.md`, `shared/framework/ops.md`, and all `shared/project/<category>/` files.
   - Note any ops or resources in the skill that duplicate existing shared content — record as `shared_findings`
5. Audit every category subdir file using the **Category Decision Flowchart** from `policies/category-decision-flowchart.md` (in order — use the first matching test). Record all misplacements as `audit_findings`.

   A file is misplaced when the flowchart assigns it to a different category than its current directory.

   > **Do not proceed to step 6 until every category file has been evaluated against every row in the flowchart.**
   > The decision table must contain rows from all three sources: `validate_findings`, `shared_findings`, and `audit_findings`.
   > An empty `audit_findings` is only valid when every category file has been explicitly checked and found correctly placed.

6. Present a decision table combining all three finding sets:

   | Content | Current file | Target file | Action | Source | Reason |
   |---------|-------------|-------------|--------|--------|--------|
   | `<description>` | `<current location>` | `<target location>` | move / extract / fix / replace with shared ref / create / delete | VALIDATE / shared / audit | `<decision-rule rationale>` |

   Then list: new files to create | files to delete | shared references to introduce. Then emit an apply block per `constants/apply-block-protocol.md` with fields: `op: IMPROVE` | `skill: <name>` | `changes`.

7. Ask: **"Proceed? | Yes | Adjust | No"** — wait for response before touching any file.
8. Apply all changes:
   - Read `policies/preservation-rules.md` before modifying any file
   - Fix every Error and Warning from VALIDATE
   - Relocate misplaced category file content per `audit_findings`
   - Extract any remaining inline blocks from `skill.md` to the correct category files
   - Replace skill-local op definitions or resource files that duplicate shared content: delete the local copy and update the reference in `skill.md`/`ops.md` to point to the shared location
   - If the skill makes changes to files but has no `VERIFY_EXPECTED` node, include a row in the decision table: `— | — | verify/verify-expected.md | create` with reason "skill makes changes but has no verification step"; add `VERIFY_EXPECTED << verify/verify-expected.md` as the last node inside the success branch and create `verify/verify-expected.md` with an appropriate expected-state checklist
   - Preserve existing tree syntax (do not switch `*` ↔ box-drawing unless asked)
   - Do not change skill logic or intent
9. Run VALIDATE inline on all modified files. Fix every remaining Error and Warning — not just newly introduced ones, but any violation still present after the changes. Repeat until VALIDATE reports no Errors or Warnings on any file.
10. Verify result against `verify/improve-expected.md`.
11. Report: **Summary / Issues fixed / Shared references introduced / Files changed / Files created / Files deleted**

