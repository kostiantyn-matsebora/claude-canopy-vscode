# Expected State After Bump

- [ ] `version` in `package.json` updated to the new version string
- [ ] New `## [X.Y.Z] — YYYY-MM-DD` heading prepended to `docs/CHANGELOG.md` with today's date
- [ ] Changelog entry contains at least one non-empty group (`### Added`, `### Changed`, or `### Fixed`)
- [ ] No existing changelog entries modified or removed
- [ ] New version is strictly greater than the previous version (correct semver increment)
- [ ] A git commit with message `chore: release v<new_version>` exists at HEAD
- [ ] No local git tag for the new version exists (`git tag --list "v<new_version>"` returns empty)
