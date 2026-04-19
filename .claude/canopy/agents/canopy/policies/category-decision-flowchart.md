# Category Decision Flowchart

For every distinct block of content, apply these tests in order — use the **first matching test**:

| # | Test | → Category |
|---|------|------------|
| 1 | Contains `- [ ]` evaluation/compliance items | `checklists/` |
| 2 | Is a fillable output document with placeholder slots (`<…>`, `{{…}}`) | `templates/` |
| 3 | Is a JSON/YAML structure or report shape definition | `schemas/` |
| 4 | Is a shell/PowerShell script or command invocation | `commands/` |
| 5 | Tells the agent what it **must** or **must not** do, or prescribes a sequence the agent must follow (includes "always read X", "write in this order", "do not flag X") | `policies/` |
| 6 | Is a reference table or list the agent **looks values up from** but does not follow as instructions (parameter tables, metric definitions, error code maps, delta thresholds) | `constants/` |
| 7 | Is a sequential step or conditional | tree node or named op in `ops.md` |

A file is misplaced when the flowchart assigns it to a different category than its current directory.
