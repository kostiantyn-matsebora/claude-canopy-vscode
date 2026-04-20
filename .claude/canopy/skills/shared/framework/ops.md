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

## SWITCH \<\< expression

```
SWITCH << expression
├── CASE << value1
│   └── branch1
[├── CASE << value2
│   └── branch2]
[└── DEFAULT
    └── default-branch]
```

Evaluate `expression` once against step context.
Match its value against each `CASE` in order; execute the first matching branch and skip the rest.
`DEFAULT` executes only if no `CASE` matched.
Branches may be op calls or natural language.
Use when branching on a single expression against multiple discrete values.

---

## CASE \<\< value

A branch within a `SWITCH` block.
Evaluated only if no prior `CASE` in the same `SWITCH` has matched.
Executed when the `SWITCH` expression equals `value`.
Branch may be an op call or natural language.

---

## DEFAULT

Closes a `SWITCH` block.
Executed only if no `CASE` in the block matched.
Branch may be an op call or natural language.

---

## FOR_EACH \<\< item in collection

```
FOR_EACH << item in collection
├── body-step-1
├── body-step-2
[└── IF << exit condition
    └── BREAK]
```

Bind `item` to each element of `collection` in turn and execute the body once per element.
If `collection` is empty, the body is skipped entirely.
`BREAK` inside the body exits the loop immediately; execution resumes at the next sibling after `FOR_EACH`.
Body steps may be op calls or natural language.

---

## BREAK

Exit the current loop (`FOR_EACH`) or current op immediately.
Inside `FOR_EACH`: stops iteration and resumes at the next sibling after the loop.
Outside a loop: exits the current op and returns to the caller's next node.
Does not halt the skill — execution resumes at the next sibling in the calling tree.
Use for early exit from iteration or optional branches within an op where remaining steps are not needed.

---

## END [message]

Halt the entire skill execution immediately.
Display `<message>` to the user if provided.
Use for fatal conditions and guard checks that make further execution invalid.
