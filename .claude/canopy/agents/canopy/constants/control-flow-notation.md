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
