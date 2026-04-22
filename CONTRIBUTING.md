# Contributing

Thanks for your interest in contributing to Canopy Skills.

## Reporting issues

Use the [GitHub Issues](https://github.com/kostiantyn-matsebora/claude-canopy-vscode/issues) tracker. Pick the **Bug report** or **Feature request** template — filling out the prompts makes triage much faster.

## Development setup

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for:

- Prerequisites and local build/test/package commands
- Running the extension in an Extension Development Host (`F5`)
- Installing the built `.vsix` into your regular VS Code
- Unit test layout and mock setup
- Source architecture and data flow
- How to add a new primitive, category, diagnostic, frontmatter field, section, or command
- Release workflow

## Keeping in sync with the framework

The extension is a consumer of the [Canopy framework](https://github.com/kostiantyn-matsebora/claude-canopy). When the framework changes, the extension must be updated to reflect those changes. See the **Keeping in Sync with claude-canopy** section in [`CLAUDE.md`](CLAUDE.md) for the full sync-point table.

## Pull requests

- Keep the scope focused — one concern per PR.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) in commit messages and PR titles (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Add or update tests under `src/test/` for any behavior change.
- Run `npm run compile` and `npm test` before pushing.
- Update `CHANGELOG.md` under an `## [Unreleased]` section (or the next version section) for user-visible changes.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [`LICENSE`](LICENSE)).
