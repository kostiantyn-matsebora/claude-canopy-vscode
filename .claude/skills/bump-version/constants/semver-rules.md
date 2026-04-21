# Semver Classification Rules

Map a change description to a bump level. Use the **first matching rule**.

| # | Change matches | Bump level |
|---|----------------|------------|
| 1 | Removes a public API, command, setting, or language ID | `major` |
| 2 | Changes existing behaviour in a way that breaks existing skill files or user configuration | `major` |
| 3 | Adds a new command, setting, language ID, or IntelliSense provider | `minor` |
| 4 | Adds support for a new Canopy primitive, category, or frontmatter field | `minor` |
| 5 | Adds a new Canopy agent operation or scaffold capability | `minor` |
| 6 | Extends existing behaviour without breaking it (e.g. new completion item, new hover doc) | `minor` |
| 7 | Bug fix, diagnostic accuracy improvement, or error message update | `patch` |
| 8 | Documentation update, changelog edit, or internal refactor with no behaviour change | `patch` |
| 9 | Dependency update or build tooling change with no behaviour change | `patch` |
| 10 | Canopy subtree bump with no extension code changes | `patch` |
