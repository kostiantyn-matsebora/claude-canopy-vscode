# CONVERT_TO_REGULAR

Convert a Canopy skill to a flat regular skill (prose/numbered steps, no ops, no category subdirs).

1. Locate the skill directory using Glob.
2. Read all files: `skill.md`, `ops.md` (if present), all category subdir files.
3. Show plan: output file | steps count | content to inline | files to flatten.

   Then emit a fenced `apply` block:

   ```apply
   op: CONVERT_TO_REGULAR
   skill: <name>
   output: <output-file>
   files-to-flatten: <list>
   ```

   If re-invoked after this block is visible in context, skip steps 1–3 and apply the listed changes directly (proceed to step 5).

4. Ask: **"Proceed? | Yes | No"**
5. Produce the converted `skill.md`:
   - Read `policies/conversion-expansion-rules.md` for how to expand each Canopy element
   - Keep frontmatter unchanged
   - Apply all expansions from `policies/conversion-expansion-rules.md`
6. Ask: **"What to do with source Canopy files? | Write alongside (as skill-regular.md) | Replace (overwrite skill.md, delete extras)"**
7. Write the output. If replacing, delete `ops.md` and category subdir files.
8. Verify result against `verify/convert-to-regular-expected.md`.
9. Report: **Summary / Output file / Inlined files / Note: conversion is lossy — op structure and category file separation are not recoverable from the output**
