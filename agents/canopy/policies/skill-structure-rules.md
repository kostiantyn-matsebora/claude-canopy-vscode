# Skill Structure Rules

## skill.md must contain only orchestration

`skill.md` must contain:
- Frontmatter (`name`, `description`, `argument-hint`)
- `## Agent`, `## Tree`, `## Rules`, `## Response:` sections
- Op calls and natural language in the tree
- `Read <category>/<file>` references at point of use

`skill.md` must NOT contain:
- Tables
- JSON, YAML, or any structured data blocks
- Scripts, shell commands, or code fences with executable content
- Inline examples or templates
- Phase-by-phase prose when a `## Tree` is possible
- Hardcoded platform-specific paths (`.claude/` or `.github/`) in tree nodes or `Read` references — all category file references must be relative to the skill directory (e.g. `policies/rules.md`, not `.claude/skills/my-skill/policies/rules.md`)
- Complex inline command invocations (multi-flag or multi-argument shell commands) — extract to a `commands/` script and invoke it from the tree

## Structural requirements

- `## Tree`, `## Rules`, and `## Response:` sections are all required.
- All structured content must be extracted to the appropriate category subdirectory file.
- `ops.md` is only written when ops are not already covered by shared.
- Category files are only written when content is not already in shared.
