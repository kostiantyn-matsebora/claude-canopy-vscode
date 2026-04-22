# Control Flow Notation — Migration Table

Replace all ad-hoc control flow patterns with standard Canopy ops:

| Old pattern | Replace with |
|---|---|
| `Ask: "question? (yes/no)"` | `ASK << question? \| Yes \| No` |
| `Show Plan (field1, field2)` | `SHOW_PLAN >> field1 \| field2` |
| `Read verify/verify-expected.md for expected state` | `VERIFY_EXPECTED` |
| `→ {fields}` (output capture) | `>> {fields}` |
| `IF << condition → action` (inline branch) | `IF << condition` with `action` as nested child node |
| `ELSE → action` (inline branch) | `ELSE` with `action` as nested child node |
| `if X: do Y` (in steps) | `IF << X` tree node with `Y` as child |
| `else if Y: do Z` (in steps) | `ELSE_IF << Y` chained after `IF` |
| `else: do Z` (in steps) | `ELSE` chained after `IF` or `ELSE_IF` |
| early return from op (no error) | `BREAK` |
| fatal stop with message | `END <message>` |
| `if X: do Y / else if Y: do Z / ...` repeated over one value | `SWITCH << X` with `CASE << Y` branches |
| `ELSE_IF` chain matching `value == "a"`, `value == "b"`, … | `SWITCH << value` with `CASE << "a"`, `CASE << "b"`, … |
| `for each X in Y` prose loop (or numbered step repeated per item) | `FOR_EACH << x in y` with loop body as child nodes |
| `FOR_EACH << x in y` with no exit condition | add `IF << exit condition` + `BREAK` child if early exit is needed |
