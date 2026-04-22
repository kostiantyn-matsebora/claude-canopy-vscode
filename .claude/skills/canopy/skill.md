---
name: canopy
description: Shorthand for the Canopy agent — creates, modifies, scaffolds, validates, improves, and advises on Canopy skills.
argument-hint: "<operation> [skill-name]  (e.g. improve bump-version)"
---

$ARGUMENTS

---

## Tree

* canopy
  * IF << .claude/agents/canopy.md exists
    * Follow `.claude/agents/canopy.md` and $ARGUMENTS
  * ELSE
    * Follow `.github/agents/canopy.md` and $ARGUMENTS
