# Project-Wide Ops

Shared ops specific to this project. Available to all skills; not portable to other projects without adaptation.

Add an op here when:
- The same multi-step pattern appears in 2 or more skills
- The behavior is complex enough to warrant a named abstraction
- The op involves project-specific tools, APIs, or conventions

Notation: `<<` input source or options, `>>` captured output or displayed fields, `|` item separator.
Op definitions may use tree notation internally (same syntax as skill.md `## Tree`).

---

# ── Examples (commented out — uncomment and adapt for your project) ──────────

# ## MY_DEPLOY << dir
#
# Deploy the application in `<dir>`.
# 1. Run dry-run: show diff
# 2. ASK << Proceed? | Yes | No
# 3. Apply changes

# ## MY_VERIFY << namespace
#
# Check that all pods in `<namespace>` are Running/Ready.
# Report any pods that are not ready after 2 minutes.

# ## MY_SECRET_READ << path >> {fields}
#
# Read secret at `<path>` from the project secret store.
# Capture named `{fields}` into step context.

# ## MY_SECRET_WRITE << path << {fields}
#
# Write `{fields}` to `<path>` in the project secret store.
# Patch if path exists; create if new.

# ─────────────────────────────────────────────────────────────────────────────
