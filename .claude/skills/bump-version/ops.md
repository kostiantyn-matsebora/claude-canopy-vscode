# bump-version — Local Ops

---

## UPDATE_README << changes_summary

Update `README.md` to reflect the changes in the new release.

* UPDATE_README << changes_summary
  * IF << changes_summary contains a Canopy framework version bump
    * Update the "Supports Canopy framework vX.Y.Z" reference on line 3 of `README.md` to the new canopy version
  * IF << changes_summary contains new primitives or new extension features
    * Update the relevant section(s) of `README.md` (primitives list, features section) to reflect the additions
  * IF << no README-relevant changes detected
    * BREAK

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
