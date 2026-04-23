# Debug Output Protocol

Apply this policy whenever executing under the `canopy-debug` skill.

canopy-debug uses two output channels simultaneously:

| Channel | Content | Updates |
|---------|---------|---------|
| **Chat stream** | Phase banners + compact one-liner per state change | Appended progressively |
| **Trace file** `.canopy-debug-trace.log` | Full tree — always the current snapshot | Overwritten after every state change |

Open `.canopy-debug-trace.log` in a VS Code split panel — VS Code auto-refreshes the editor
when the file changes on disk. The file always shows what Claude is doing right now.

---

## Phase Registry

Phases execute in this order. Use these labels and ordinals exactly.

| # | Label          | Active when                                      |
|---|----------------|--------------------------------------------------|
| 1 | Initialize     | Always                                           |
| 2 | Explore        | Only when target skill has `## Agent` section    |
| 3 | Tree Execution | Always                                           |
| 4 | Verify         | Only when target skill tree contains VERIFY_EXPECTED |
| 5 | Response       | Always                                           |

When Explore is absent, number remaining phases 1, 2, 3, 4.
When Verify is absent, number remaining phases accordingly.
Always show `Phase N of M` where M = count of active phases for this skill run.

Phase descriptions (substitute `<skill>` with the target skill name):

| Label          | Description                                                  |
|----------------|--------------------------------------------------------------|
| Initialize     | Parsing arguments and setting up execution context for `<skill>` |
| Explore        | Launching explore subagent to gather project context         |
| Tree Execution | Executing `<skill>` tree — N nodes                           |
| Verify         | Checking outcomes against expected state                     |
| Response       | Composing final response                                     |

---

## Phase Banner Format

Render a full-width double-box banner at the start of each phase. Target width: 60 characters.

```
╔══ Phase N of M: PHASE LABEL ══════════════════════════════╗
║  <one-line phase description>                             ║
╚════════════════════════════════════════════════════════════╝
```

Pad the title line with `═` characters to reach 60 chars. Pad the description line with
spaces. Trim description to fit within the box if needed.

---

## Node State Symbols

| Symbol | State     | Meaning                               |
|--------|-----------|---------------------------------------|
| →      | executing | About to execute / currently running  |
| ⟳      | subagent  | Subagent executing                    |
| ✓      | done      | Completed successfully                |
| ◎      | simulated | Would execute in real run — skipped in plan mode |
| ⊘      | skipped   | Branch not taken (condition false)    |
| ✗      | failed    | Failed or END triggered               |
| ⏸      | waiting   | ASK — waiting for user input (edit mode only) |
| ⊙      | pending   | Not yet reached                       |

---

## Stream Output Format

The chat stream uses compact one-liners — not full tree blocks.

```
  <symbol>  <node text>
```

One line emitted per TRACE_NODE call. Both the executing (→) and done (✓) states emit a
line, so the stream shows the full progression as a completion log.

Exceptions where the stream renders additional output:
- **SHOW_PLAN**: plan table renders inline after the `✓  SHOW_PLAN` line
- **ASK in edit mode**: question and options render for user to respond to
- **HALTED box**: renders after the `✗` line

If the node has declared `<<` inputs and state is executing, emit after the one-liner:
```
  inputs:  field1=value  field2=value
```
If the node has declared `>>` outputs and state is done, emit:
```
  outputs: field1=value  field2=value
```
Omit if no formal inputs/outputs or no values to display.

---

## Trace File Format

Path: `.canopy-debug-trace.log` (project root). Overwritten after every TRACE_NODE call.

```
canopy-debug — scaffold-skill new-skill
Phase 2 of 3: Tree Execution

─── scaffold-skill ──────────────────────────────────────
  ✓  validate new-skill is valid kebab-case
  ✓  IF << new-skill is not valid kebab-case
     ⊘  END Skill name must be kebab-case
  →  IF << .claude/skills/new-skill/ exists              ← here
     ⊙  END Skill already exists...
  ⊙  SHOW_PLAN >> skill name | files | directories
  ⊙  ASK << Proceed? | Yes | No
  ⊙  CREATE_SKILL_FILES << new-skill
  ⊙  confirm files created
  ⊙  print next steps to user
────────────────────────────────────────────────────────
```

Tree block rules (same as before, now applied to the file only):
- Show ALL nodes every time — never truncate
- Top-level nodes: 2-space indent, then symbol, then 2 spaces, then node text
- Child nodes of IF/ELSE: add 2 more spaces per nesting level
- Align `← here` annotation at column 55
- Skipped branch children all get ⊘

When `node=none` (initial write at start of Initialize): render all nodes as ⊙, no `← here`.

---

## Mode-Aware Execution

canopy-debug respects the current Claude Code mode.

### Plan mode active

Mutating nodes (named op calls that are not framework primitives) are simulated:
- Emit stream one-liner with `◎`
- Print: `  ◎  would execute: <node text>  (no changes applied)`
- Mark the node `◎` in subsequent trace file writes

ASK nodes are auto-simulated with "Yes":
- Emit stream one-liner with `◎`
- Print: `  (simulated: Yes — plan mode active)`
- Mark `◎` in subsequent trace file writes

Read-only nodes always execute normally (both modes) so branch conditions resolve
correctly: `IF`/`ELSE` evaluation, natural language checks, `SHOW_PLAN`, `EXPLORE`,
`VERIFY_EXPECTED`.

### Edit mode

All nodes execute normally including mutations. ASK nodes pause for real user input
using `⏸` state as normal.

---

## ASK Interaction

In **edit mode**: emit `⏸` one-liner, render the question and options, wait for user
response, then emit `✓` one-liner.

In **plan mode**: emit `◎` one-liner, print simulation note — no user input.

---

## EXPLORE Subagent

Emit `⟳  EXPLORE >> context  (subagent running)` to stream while subagent runs.
In trace file: use ⟳ and append `(subagent running)` after the node text.
After subagent completes, emit `✓  EXPLORE >> context` and update trace file with ✓.

---

## END / HALTED Display

When END is triggered:
1. Emit `✗  <node text>` one-liner to stream
2. Write trace file with ✗ on the triggering node, all subsequent pending nodes ⊘
3. Emit HALTED box to stream:

```
╔══ HALTED ══════════════════════════════════════════════╗
║  <END message, or "Skill halted." if no message>       ║
╚════════════════════════════════════════════════════════╝
```
