# Platform Targeting Rules

Applies to any op that creates or writes skill files (CREATE, SCAFFOLD, CONVERT_TO_CANOPY).

## Resolving the target platform

Use `context.available_platforms` and `context.explicit_target_platform` (both set by the explore subagent):

1. If `context.explicit_target_platform` is set → use it; skip ASK
2. Else if `context.available_platforms` has exactly one entry → use it; skip ASK
3. Else if `context.available_platforms` contains both → ASK << Which platform should the skill target? | Claude Code (.claude/skills/) | GitHub Copilot (.github/skills/)

## Platform → skills base path

| Platform | Skills base path |
|----------|-----------------|
| `claude` | `.claude/skills/` |
| `copilot` | `.github/skills/` |

## Cross-platform skill content rule

Regardless of which platform is targeted, the produced `skill.md` must contain **no hardcoded platform-specific paths** — no `.claude/` or `.github/` references in tree nodes, op calls, or `Read` references. Category file references are always relative to the skill directory (e.g., `policies/bump-rules.md`, not `.claude/skills/bump-version/policies/bump-rules.md`). This ensures the same `skill.md` runs correctly on either platform when the files are present.
