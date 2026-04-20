# Debug Meta-Skill Rules

The `debug` skill wraps any target skill via `EXECUTE_WITH_TRACE`. It reads the target skill's tree and executes it while emitting phase banners and node-trace output.

## When creating or modifying skills

- Never insert debug hooks, `IF << debug_mode` branches, or `TRACE_*` op calls into target skills — debug mode must remain a wrapper, never an intrusion.
- The ops `EMIT_PHASE_BANNER`, `EXECUTE_WITH_TRACE`, `TRACE_NODE`, and `TRACE_EXECUTE_NODES` are skill-local to `debug/ops.md` — do not flag them as unknown ops when validating the `debug` skill.

## During VALIDATE

- If a skill contains `IF << debug_mode` or any `TRACE_*` call, flag it as a **Warning**: debug awareness must not be baked into target skills.
