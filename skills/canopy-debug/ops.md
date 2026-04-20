# canopy-debug — Local Ops

---

## EMIT_PHASE_BANNER << phase | skill | args

Render a full-width phase banner to the output stream.

Read `policies/debug-output.md` for banner format, phase registry, and phase descriptions.

* EMIT_PHASE_BANNER << phase | skill | args
  * look up phase number and total active phase count from the phase registry in debug-output.md
  * look up one-line phase description from debug-output.md, substituting skill name where indicated
  * render banner in the double-box format defined in debug-output.md
  * IF << phase = Initialize
    * include skill name and args in the banner body

---

## WRITE_TRACE_FILE << node | index | state | executed | node_list | current_phase | target_skill | skill_args

Overwrite `.canopy-debug-trace.log` with the current execution snapshot.

* WRITE_TRACE_FILE << node | index | state | executed | node_list | current_phase | target_skill | skill_args
  * build file content:
    * line 1: `canopy-debug — <target_skill> <skill_args>`
    * line 2: `Phase N of M: <current_phase label>`
    * blank line
    * full tree block using Tree-State Block Format from debug-output.md
      (all nodes, correct symbols, ← here annotation on current node)
  * write (overwrite) `.canopy-debug-trace.log` with the built content

---

## EXECUTE_WITH_TRACE << target_skill | skill_args

Execute the target skill from its first tree node to completion, emitting a phase banner and
compact one-liner before and after each node, and writing live tree state to the trace file.

* EXECUTE_WITH_TRACE << target_skill | skill_args
  * locate target_skill at `.claude/skills/<target_skill>/skill.md`
  * IF << skill file not found
    * END Skill not found: target_skill
  * read the skill's ## Tree section >> node_list
  * read the skill's ## Agent section >> has_explore
  * read the skill's ## Tree section to check for VERIFY_EXPECTED >> has_verify
  * bind executed = []
  * bind current_index = 0
  * bind current_phase = Initialize
  * WRITE_TRACE_FILE << node=none | index=-1 | state=pending | executed=[] | node_list | current_phase | target_skill | skill_args
  * EMIT_PHASE_BANNER << phase=Initialize | skill=target_skill | args=skill_args
  * render hint: `  open .canopy-debug-trace.log in a split panel for live tree view`
  * IF << has_explore is true
    * bind current_phase = Explore
    * EMIT_PHASE_BANNER << phase=Explore | skill=target_skill
    * TRACE_NODE << node=EXPLORE | index=0 | state=executing | executed=[] | node_list=node_list
    * execute the EXPLORE subagent for target_skill >> explore_output
    * TRACE_NODE << node=EXPLORE | index=0 | state=done | executed=[EXPLORE] | node_list=node_list
    * append EXPLORE to executed
    * bind current_index = 1
  * bind current_phase = Tree Execution
  * EMIT_PHASE_BANNER << phase=Tree Execution | skill=target_skill
  * TRACE_EXECUTE_NODES << node_list | start_index=current_index | target_skill | skill_args
  * IF << has_verify is true
    * bind current_phase = Verify
    * EMIT_PHASE_BANNER << phase=Verify | skill=target_skill
    * execute VERIFY_EXPECTED for target_skill
  * bind current_phase = Response
  * EMIT_PHASE_BANNER << phase=Response | skill=target_skill

---

## TRACE_NODE << node | index | state | executed | node_list

Emit a compact one-liner to the stream and overwrite the trace file with the current snapshot.

Read `policies/debug-output.md` for state symbols and trace file format.

* TRACE_NODE << node | index | state | executed | node_list
  * determine symbol for this node based on state (→ ✓ ◎ ⊘ ✗ ⏸ ⟳)
  * emit to stream: `  <symbol>  <node text>`
    * IF << state = executing and node has declared `<<` inputs — emit `  inputs:  field=value ...` line
    * IF << state = done and node has declared `>>` outputs — emit `  outputs: field=value ...` line
  * WRITE_TRACE_FILE << node | index | state | executed | node_list | current_phase | target_skill | skill_args

---

## TRACE_EXECUTE_NODES << node_list | start_index | target_skill | skill_args

Iterate over nodes from start_index. Behavior depends on the current Claude Code mode:
- Plan mode active: simulate mutating nodes and ASK; execute read-only nodes normally
- Edit mode: execute all nodes normally including mutations; pause on ASK for real user input

Read `policies/debug-output.md` for simulation format and mode behavior rules.

Framework primitives never simulated regardless of mode: IF, ELSE_IF, ELSE, BREAK, END, SHOW_PLAN, VERIFY_EXPECTED, EXPLORE.

* TRACE_EXECUTE_NODES << node_list | start_index | target_skill | skill_args
  * bind in_plan_mode = true if Claude Code plan mode is currently active, false otherwise
  * for each node in node_list starting at start_index
    * TRACE_NODE << node | index | state=executing | executed | node_list
    * IF << node is ASK
      * IF << in_plan_mode
        * TRACE_NODE << node | index | state=simulated | executed | node_list
        * render `  (simulated: Yes — plan mode active)`
      * ELSE
        * render the ASK question and options as defined in the target skill
        * TRACE_NODE << node | index | state=waiting | executed | node_list
        * wait for user response
        * TRACE_NODE << node | index | state=done | executed | node_list
    * ELSE_IF << node is IF or ELSE_IF or ELSE
      * evaluate the condition against step context
      * IF << condition is true
        * mark all other branches in this chain ⊘
        * recurse into branch children: TRACE_EXECUTE_NODES << branch_children | 0 | target_skill | skill_args
        * TRACE_NODE << node | index | state=done | executed | node_list
      * ELSE
        * TRACE_NODE << node | index | state=skipped | executed | node_list
        * mark all children of this node ⊘
    * ELSE_IF << node is END
      * TRACE_NODE << node | index | state=failed | executed | node_list
      * render HALTED box with END message from debug-output.md
      * halt execution — propagate END upward
    * ELSE_IF << node is a named op call (ALL_CAPS, not a framework primitive) and in_plan_mode
      * TRACE_NODE << node | index | state=simulated | executed | node_list
      * render `  ◎  would execute: <node text>  (no changes applied)`
    * ELSE
      * execute the node's op or natural language logic for target_skill
      * TRACE_NODE << node | index | state=done | executed | node_list
    * append node to executed list
