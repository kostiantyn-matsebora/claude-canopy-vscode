# Framework Primitives

Control-flow and interaction primitives available in every skill tree, in every project.
These ops are never overridden by project or skill-local ops.

Notation: `<<` input source or options, `>>` captured output or displayed fields, `|` item separator.

---

## ASK \<question\> \<\< option1 | option2 [| ...]

Present `<question>` with the listed options.
Do not proceed past this step until the user responds.

---

## SHOW_PLAN \>\> field1 | field2 | ...

Present a structured plan showing all listed fields before any changes are made.

---

## VERIFY_EXPECTED \<\< verify/verify-expected.md

Check current state against expected outcomes defined in `verify/verify-expected.md`.

---

## IF \<\< condition

```
IF << condition
├── then-branch
[ELSE_IF << condition2
 ├── branch2]
[ELSE
 └── else-branch]
```

Evaluate `condition` against step context.
Execute first matching branch; remaining branches skipped.
Branches may be op calls or natural language.

---

## ELSE_IF \<\< condition

Continues an `IF` or `ELSE_IF` chain.
Evaluated only if all prior conditions were false.
Branches may be op calls or natural language.

---

## ELSE

Closes an `IF` or `ELSE_IF` chain.
Executed only if all prior conditions were false.
Branch may be an op call or natural language.

---

## BREAK

Exit the current op immediately and return to the caller's next node.
Does not halt the skill — execution resumes at the next sibling in the calling tree.
Use for optional branches within an op where remaining steps are not needed.

---

## END [message]

Halt the entire skill execution immediately.
Display `<message>` to the user if provided.
Use for fatal conditions and guard checks that make further execution invalid.
