# Target Platform Triggers

Trigger phrases that indicate the user explicitly named a target platform for a write operation. Use the first matching row.

| Trigger pattern | `explicit_target_platform` |
|-----------------|----------------------------|
| "for claude", "as claude", "claude code", "in .claude" | `claude` |
| "for copilot", "as copilot", "github copilot", "in .github" | `copilot` |

If no trigger matches, `explicit_target_platform` is `null` — the operation falls through to `available_platforms` (ASK if both present; use the single platform if only one present).
