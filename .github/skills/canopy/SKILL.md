---
name: canopy
description: Shorthand for the canopy-agent skill — provides the /canopy slash command. Type /canopy <operation> to author, validate, improve, scaffold, refactor, advise on, or convert Canopy skills (operations CREATE, MODIFY, SCAFFOLD, VALIDATE, IMPROVE, ADVISE, REFACTOR, CONVERT_TO_CANOPY, CONVERT_TO_REGULAR, HELP). Delegates to the canopy-agent skill.
license: MIT
argument-hint: "<operation> [skill-name]  (e.g. improve bump-version)"
metadata:
  version: "0.17.0"
  author: kostiantyn-matsebora
---

$ARGUMENTS

---

## Tree

* canopy
  * IF << .claude/skills/canopy-agent/SKILL.md exists
    * Follow `.claude/skills/canopy-agent/SKILL.md` and $ARGUMENTS
  * ELSE
    * Follow `.github/skills/canopy-agent/SKILL.md` and $ARGUMENTS
