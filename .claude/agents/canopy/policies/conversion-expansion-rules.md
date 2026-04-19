# Conversion Expansion Rules

When converting a Canopy skill to regular (flat prose) format, apply these expansions in order:

| Canopy element | Expand to |
|---|---|
| `## Tree` | `## Steps` (numbered list) |
| `IF << condition` / `ELSE_IF` / `ELSE` | Conditional prose: "If `<condition>`: … Otherwise: …" |
| `ASK << question \| opt1 \| opt2` | "Ask the user: `<question>` (`opt1` / `opt2`)" |
| `SHOW_PLAN >> fields` | "Show the user a plan with: `<fields>`" |
| `VERIFY_EXPECTED << file` | "Verify: check the expected-state list in `<file>`" |
| Named op call (e.g. `RESOLVE_SCOPE`) | Inline the full op definition from `ops.md` at that position |
| `Read \`<category>/<file>\`` | Inline the actual file content as a subsection or code block |
| `## Agent` section | Convert to prose preamble step: "Explore: read X and return Y" |

**Note: conversion is lossy.** Op structure and category file separation are not recoverable from the flattened output.
