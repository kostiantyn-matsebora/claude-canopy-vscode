# Apply Block Protocol

After SHOW_PLAN, emit a fenced `apply` block that captures the agreed plan as a structured summary.

```
op: <OP_NAME>
<op-specific fields as key: value pairs>
changes:
  - <file-path> | <action> | <detail>
```

**Re-invocation rule:** If the same op is invoked again while this block is visible in conversation context, skip all planning steps and apply the listed changes directly. The block is the authoritative source of what was agreed.
