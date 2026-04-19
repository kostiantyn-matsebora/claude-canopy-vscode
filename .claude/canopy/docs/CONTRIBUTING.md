# Contributing to Canopy

Thanks for contributing.

## Scope

This repo is the framework itself. Good contributions include:

- framework docs and clarifications
- improvements to bundled skills
- framework primitives or resource-loading behavior
- setup and submodule integration fixes

If a change affects framework behavior, keep these files in sync:

- `docs/FRAMEWORK.md`
- `rules/skill-resources.md`
- `skills/shared/framework/ops.md`
- `agents/canopy/policies/optimization-rules.md`

## Getting Started

1. Fork the repository.
2. Create a branch from `master`.
3. Make focused changes.
4. Update docs when behavior changes.
5. Update `docs/CHANGELOG.md` for user-visible changes.
6. Open a pull request.

## Style

- Keep changes minimal and scoped.
- Preserve the framework's terminology and tree notation.
- Prefer examples that are generic rather than project-specific.
- Do not introduce breaking behavior without documenting it clearly.

## Pull Requests

Before opening a pull request, check:

- the README still matches the actual setup flow
- framework docs do not duplicate each other unnecessarily
- bundled skills still reflect current framework rules
- setup scripts still produce the documented files

## Commit Messages

Conventional Commits are preferred, for example:

- `feat: add submodule setup wiring`
- `fix: align README setup instructions with actual behavior`
- `docs: clarify tree execution model`
