---
name: canopy-debug
description: Trace any Canopy skill with live phase banners and per-node tree tracing. Respects the current mode — in plan mode no changes are applied; in edit mode the skill executes normally.
argument-hint: "<skill-name> [skill-arguments]"
---

Preamble: parse $ARGUMENTS — first token is `target_skill`, remainder is `skill_args`.

---

## Tree

* canopy-debug
  * IF << $ARGUMENTS is empty or skill name is missing
    * END Usage: /canopy-debug <skill-name> [skill-arguments]
  * bind target_skill = first token of $ARGUMENTS
  * bind skill_args = remainder of $ARGUMENTS (may be empty)
  * Read `policies/debug-output.md` for debug rendering and animation protocol
  * EMIT_PHASE_BANNER << phase=Initialize | skill=target_skill | args=skill_args
  * EXECUTE_WITH_TRACE << target_skill | skill_args

## Rules

- Load `policies/debug-output.md` before any output — never emit debug output without it
- Respect the current Claude Code mode — plan mode means simulate mutations; edit mode means execute normally
- Emit banners and tree-state blocks to the stream as Claude narrates; never buffer and emit at end

## Response: target_skill | phases_executed | nodes_executed | final_status
