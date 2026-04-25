import * as vscode from 'vscode';
import { getOpNameAtPosition, isPrimitive } from '../canopyDocument';
import { PRIMITIVE_DOCS, registry } from '../opRegistry';

const SECTION_DOCS: Record<string, string> = {
  Agent: '**`## Agent`** — Declare an `**explore**` subagent. When present, the first tree node must be `EXPLORE >> context`. Output contract is always `schemas/explore-schema.json`.',
  Tree: '**`## Tree`** *(required)* — The sequential execution pipeline. Nodes run top-to-bottom. Use `IF`/`ELSE_IF`/`ELSE` for branching. Two equivalent syntaxes: markdown list (`*`) or box-drawing (`├──`).',
  Rules: '**`## Rules`** — Skill-wide invariants as a bullet list. These are checked throughout execution.',
  Response: '**`## Response:`** — Declare the output format as pipe-separated field names (e.g. `## Response: version | files updated`).',
};

const FRONTMATTER_DOCS: Record<string, string> = {
  name: '**`name`** — Kebab-case skill identifier (e.g. `bump-version`). Used in the skill picker.',
  description: '**`description`** — One-line description shown in the skill picker.',
  'argument-hint': '**`argument-hint`** — Shows the expected arguments. Use `<required>` and `[optional]` notation (e.g. `"<version> [strategy]"`).',
  license: '**`license`** — SPDX license identifier (e.g. `MIT`).',
  'allowed-tools': '**`allowed-tools`** — Space-separated list of tools the skill may invoke (e.g. `Read Write Edit Glob Grep Bash`).',
  metadata: '**`metadata`** — Free-form metadata block. Conventional keys: `version` (semver string), `author`.',
  'user-invocable': '**`user-invocable`** — When `false`, hides the skill from the `/` menu (still loadable by other skills via the Skill tool). Default: `true`.',
};

export class CanopyHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const line = document.lineAt(position).text;

    // --- Hover on ## Section header ---
    const sectionMatch = line.match(/^##\s+(Agent|Tree|Rules|Response.*?)(\s|$)/);
    if (sectionMatch) {
      const key = sectionMatch[1].startsWith('Response') ? 'Response' : sectionMatch[1];
      const doc = SECTION_DOCS[key];
      if (doc) return new vscode.Hover(new vscode.MarkdownString(doc));
    }

    // --- Hover on frontmatter key ---
    const fmMatch = line.match(/^(name|description|argument-hint|license|allowed-tools|metadata|user-invocable):/);
    if (fmMatch) {
      const doc = FRONTMATTER_DOCS[fmMatch[1]];
      if (doc) return new vscode.Hover(new vscode.MarkdownString(doc));
    }

    // --- Hover on ALL_CAPS op name ---
    const opName = getOpNameAtPosition(line, position.character);
    if (!opName) return undefined;

    // Primitive
    if (isPrimitive(opName)) {
      const doc = PRIMITIVE_DOCS[opName];
      if (doc) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**\`${doc.signature}\`** *(framework primitive)*\n\n`);
        md.appendMarkdown(doc.description + '\n\n');
        md.appendCodeblock(doc.example, 'canopy');
        return new vscode.Hover(md);
      }
    }

    // Custom op — look up in registry
    const resolved = await registry.resolve(opName, document.uri);
    if (resolved) {
      const { definition, source } = resolved;
      const sourceLabel =
        source === 'skill-local' ? 'skill-local op' :
        source === 'project' ? 'project-wide op' : 'framework op';

      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**\`${definition.signature}\`** *(${sourceLabel})*\n\n`);
      if (definition.bodyText) {
        // Show first non-empty paragraph of body
        const firstParagraph = definition.bodyText.split(/\n\n/)[0].trim();
        if (firstParagraph) {
          md.appendMarkdown(firstParagraph);
        }
      }
      return new vscode.Hover(md);
    }

    return undefined;
  }
}
