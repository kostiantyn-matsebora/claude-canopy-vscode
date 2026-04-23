# Category Directory Reference

| Directory | File types | Contains | Decision rule |
|-----------|------------|----------|--------------|
| `schemas/` | `.json`, `.md` | Structure definitions for data the skill reads or writes: subagent output contracts, input/config file shapes, report template skeletons | Use when describing the *shape* of a document or data object — never for rules, never for lookup values |
| `templates/` | `.yaml`, `.md`, `.yaml.gotmpl` | Fillable output documents with `<token>` placeholders substituted from context and written to a target path | Use when the skill generates a file from a pattern — never for static reference data |
| `commands/` | `.ps1`, `.sh` | Executable scripts invoked by name via a named section (`# === Section Name ===`); output captured into context | Use when the skill must run a shell command — never for data or rules |
| `constants/` | `.md` | Read-only lookup data referenced by ops: mapping tables, enum-like value lists, fixed configuration values, default branch/path names | Use when an op looks up a static value from a table or list — never for behavioural constraints, never for document shapes |
| `checklists/` | `.md` | Evaluation criteria lists (`- [ ] ...`) that ops iterate over to assess compliance or correctness | Use when an op checks items against a list of criteria — never for static lookup values, never for post-execution state |
| `policies/` | `.md` | Behavioural constraints governing skill execution: what the skill must/must not do, consent requirements, output rendering protocols | Use when answering "what is the skill allowed or required to do?" — never for tables, never for schemas |
| `verify/` | `.md` | Expected-state checklists consumed exclusively by `VERIFY_EXPECTED` | Use only for post-execution verification — nothing else |
| `ops.md` | `.md` | Skill-local op definitions (alongside `SKILL.md`, not in a subdir) | Use for conditional branches, multi-step procedures, or decision trees specific to one skill |

One concern per file. Do not bundle unrelated content into a single file.

Reference line pattern in `SKILL.md`: `Read \`<category>/<file>\` for <brief description>.`
Load at point of use in the tree — never front-load all reads at the top.
