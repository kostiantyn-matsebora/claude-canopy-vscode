import * as vscode from 'vscode';
import { getOpNameAtPosition, isPrimitive } from '../canopyDocument';
import { PRIMITIVE_DOCS, registry } from '../opRegistry';

const CANOPY_FEATURES_DOC =
  '**`canopy-features`** *(under `metadata:`)* — Slice manifest declaring which primitive families this skill uses. ' +
  'Valid values: `interaction`, `control-flow`, `parallel`, `subagent`, `explore`, `verify`. ' +
  '(`core` is always loaded and must NOT be listed.) ' +
  'When present, the runtime loads only the named slices, reducing context. ' +
  'When absent, all slices are loaded for back-compat. ' +
  'Diagnostics surface drift: declared-but-unused, used-but-undeclared, unknown values, or `core` listed.';

const CANOPY_CONTRACTS_DOC =
  '**`canopy-contracts`** *(under `metadata:`)* — Opt-in runtime contract enforcement (v0.22.0+). ' +
  'Recognized value: `strict`. ' +
  'Under `strict`, the runtime validates each contract-bearing op\'s input against its declared `Input contract` before firing, ' +
  'and validates the output against the `Output contract` before binding into context. ' +
  'Halts with `[contract-violation]` on drift. ' +
  'Ops without contracts are skipped. ' +
  'Default (omitted): contracts are descriptive only; vscode static type-flow applies but runtime does not enforce.';

const SECTION_DOCS: Record<string, string> = {
  Agent: '**`## Agent`** — Declare an `**explore**` subagent. When present, the first tree node must be `EXPLORE >> context`. Output contract is `assets/schemas/explore-schema.json` (agentskills layout) or `schemas/explore-schema.json` (legacy flat layout).',
  Tree: '**`## Tree`** *(required)* — The sequential execution pipeline. Nodes run top-to-bottom. Use `IF`/`ELSE_IF`/`ELSE` for branching. Two equivalent syntaxes: markdown list (`*`) or box-drawing (`├──`).',
  Rules: '**`## Rules`** — Skill-wide invariants as a bullet list. These are checked throughout execution.',
  Response: '**`## Response:`** — Declare the output format as pipe-separated field names (e.g. `## Response: version | files updated`).',
};

const FRONTMATTER_DOCS: Record<string, string> = {
  name: '**`name`** — Kebab-case skill identifier (e.g. `bump-version`). Used in the skill picker.',
  description: '**`description`** — One-line description shown in the skill picker.',
  license: '**`license`** — SPDX license identifier (e.g. `MIT`).',
  compatibility: '**`compatibility`** — Free-text environment-requirements blurb (max 500 chars per agentskills.io spec). Canopy-flavored skills (with `## Tree`) name `canopy-runtime` and a locatable source repo so an agent can resolve the dependency from the field alone. Structured shapes like `{ requires: [...] }` are non-spec.',
  'allowed-tools': '**`allowed-tools`** — Space-separated list of tools the skill may invoke (e.g. `Read Write Edit Glob Grep Bash`).',
  metadata: '**`metadata`** — Free-form metadata block. Place non-spec fields here (`argument-hint`, `user-invocable`, `version`, `author`, etc.).',
  // Below are non-spec but commonly seen at root in legacy skills — flagged by diagnostics, but documented here so hover still works.
  'argument-hint': '**`argument-hint`** *(non-spec at frontmatter root — move into `metadata:`)* — Shows the expected arguments. Use `<required>` and `[optional]` notation.',
  'user-invocable': '**`user-invocable`** *(non-spec at frontmatter root — move into `metadata:`)* — When `false`, hides the skill from the `/` menu. Default: `true`.',
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
    const fmMatch = line.match(/^(name|description|license|compatibility|allowed-tools|metadata|argument-hint|user-invocable):/);
    if (fmMatch) {
      const doc = FRONTMATTER_DOCS[fmMatch[1]];
      if (doc) return new vscode.Hover(new vscode.MarkdownString(doc));
    }

    // --- Hover on metadata.canopy-features (indented under metadata:) ---
    const featuresMatch = line.match(/^\s+canopy-features:/);
    if (featuresMatch) {
      return new vscode.Hover(new vscode.MarkdownString(CANOPY_FEATURES_DOC));
    }

    // --- Hover on metadata.canopy-contracts (S3) ---
    const contractsMatch = line.match(/^\s+canopy-contracts:/);
    if (contractsMatch) {
      return new vscode.Hover(new vscode.MarkdownString(CANOPY_CONTRACTS_DOC));
    }

    // --- Hover on a contract-marker blockquote line ---
    // `> **Input contract:** \`<path>\`` or `> **Output contract:** \`<path>\``
    // Surface a brief "Op contract (v0.22.0+)" tooltip with the contract role.
    const contractMarkerMatch = line.match(/^>\s+(?:\*\*)?(Input|Output) contract:?\*?\*?/i);
    if (contractMarkerMatch) {
      const kind = contractMarkerMatch[1].toLowerCase();
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**${kind === 'input' ? 'Input' : 'Output'} contract** *(v0.22.0+ universal op contract)*\n\n`);
      md.appendMarkdown(
        kind === 'input'
          ? 'JSON Schema describing the bound `<<` input value. vscode walks the binding graph to ' +
            'flag drift between this schema and the upstream producer\'s output. Under ' +
            '`metadata.canopy-contracts: strict`, the runtime validates the bound input before the op fires.'
          : 'JSON Schema describing the `>>` output value the op emits. Downstream consumers reading ' +
            '`<< ctx.<key>` are statically checked against this schema. Under ' +
            '`metadata.canopy-contracts: strict`, the runtime validates the output before binding into context.'
      );
      return new vscode.Hover(md);
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
        md.appendMarkdown(`Slice: \`${doc.slice}\`\n\n`);
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
      const dispatchSuffix = definition.isSubagent ? ', subagent dispatch' : '';
      md.appendMarkdown(`**\`${definition.signature}\`** *(${sourceLabel}${dispatchSuffix})*\n\n`);
      // S3: contracts surface for both subagent and inline ops.
      if (definition.isSubagent || definition.outputContract || definition.inputContract) {
        const tagLines: string[] = [];
        if (definition.isSubagent) tagLines.push('_Subagent op._');
        if (definition.inputContract) {
          tagLines.push(`Input contract: \`${definition.inputContract}\``);
        }
        if (definition.outputContract) {
          tagLines.push(`Output contract: \`${definition.outputContract}\``);
        }
        if (tagLines.length > 0) {
          md.appendMarkdown(tagLines.join('  \n') + '\n\n');
        }
      }
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
