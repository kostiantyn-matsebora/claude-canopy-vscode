# bump-version — Local Ops

---

## DETERMINE_BUMP_TYPE << changes >> bump_type | new_version

Classify the changes and determine the appropriate semver bump level and new version string.

* DETERMINE_BUMP_TYPE << changes >> bump_type | new_version
  * Read `constants/semver-rules.md` for classification rules
  * Classify each item in `changes` against the rules
  * IF << any change is classified as breaking
    * Set bump_type to "major"
    * Increment major segment
    * Reset minor and patch to 0
  * ELSE_IF << any change is classified as feature
    * Set bump_type to "minor"
    * Increment minor segment
    * Reset patch to 0
  * ELSE
    * Set bump_type to "patch"
    * Increment patch segment only
