# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Canopy Skills, please report it privately via GitHub Security Advisories:

https://github.com/kostiantyn-matsebora/claude-canopy-vscode/security/advisories/new

Please do not open a public issue for security-sensitive reports. You can expect an initial response within 7 days; coordinated disclosure timelines will be discussed in the advisory thread.

## Supported Versions

Security fixes are released against the latest published version on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=canopy-ai.canopy-skills). Earlier versions are not patched — please update before reporting issues that may already be fixed.

## Scope

In scope:

- The published Canopy Skills extension (`canopy-ai.canopy-skills`) — code that runs in a user's VS Code instance.
- Build and release tooling under `.github/workflows/`.

Out of scope (please report upstream instead):

- The Canopy framework itself — report at https://github.com/kostiantyn-matsebora/claude-canopy/security
- VS Code, the Marketplace, and Microsoft-operated infrastructure — report via the [Microsoft Security Response Center](https://msrc.microsoft.com/).
