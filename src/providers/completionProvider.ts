import * as vscode from 'vscode';
import { parseDocument, SectionKind, isPrimitive } from '../canopyDocument';
import { PRIMITIVE_DOCS, registry } from '../opRegistry';

// agentskills.io spec — only these fields are valid at frontmatter root.
// `argument-hint` and `user-invocable` are non-spec; they go inside `metadata`.
const FRONTMATTER_KEYS = [
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
];
const SECTION_NAMES = ['Agent', 'Tree', 'Rules', 'Response:'];
// Valid values for `metadata.canopy-features` (the per-skill slice manifest).
// `core` is always loaded and must NOT be declared.
const CANOPY_FEATURE_NAMES = [
  'interaction', 'control-flow', 'parallel', 'subagent', 'explore', 'verify',
];
// Standard agentskills.io layout (preferred) AND legacy flat layout (still supported).
const CATEGORY_DIRS = [
  // Standard layout
  'scripts/', 'references/',
  'assets/schemas/', 'assets/templates/', 'assets/constants/',
  'assets/policies/', 'assets/verify/', 'assets/checklists/',
  // Legacy flat layout (backward-compatible)
  'schemas/', 'templates/', 'commands/', 'constants/',
  'policies/', 'verify/', 'checklists/',
];

export class CanopyCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const parsed = parseDocument(document);
    const line = document.lineAt(position).text;
    const prefix = line.substring(0, position.character);

    // --- Frontmatter field names ---
    if (this.isInFrontmatter(document, position)) {
      // Inside `canopy-features: [...]` array — offer the 6 valid slice names.
      const featuresMatch = prefix.match(/^\s+canopy-features:\s*\[([^\]]*)$/);
      if (featuresMatch) {
        return this.canopyFeatureCompletions(featuresMatch[1]);
      }
      if (/^\s*$/.test(prefix) || /^[a-z-]*$/.test(prefix.trim())) {
        return this.frontmatterCompletions();
      }
    }

    // --- Section header names (after ##) ---
    if (/^##\s+\w*$/.test(prefix)) {
      return this.sectionCompletions();
    }

    // --- Read `category/...` completions ---
    const readCategoryMatch = prefix.match(/\bRead\s+`([a-z][a-z/]*)?$/);
    if (readCategoryMatch) {
      return this.categoryCompletions(readCategoryMatch[1] ?? '');
    }

    // --- Verify path after VERIFY_EXPECTED ---
    // Both `verify/` (legacy flat layout) and `assets/verify/` (agentskills) are valid.
    const verifyMatch = prefix.match(/\bVERIFY_EXPECTED\s+<<\s+(?:assets\/)?verify\/(\w*)$/);
    if (verifyMatch) {
      return []; // could list verify/ files — skipped for now
    }

    // --- Tree node completions: op names and primitives ---
    const currentSection = this.getSectionAtLine(parsed, position.line);
    if (currentSection === 'tree' || parsed.isOpsFile) {
      const hasBoxConnector = /[├└]─/.test(line);   // ├── or └── already present
      const hasBoxIndent = /│/.test(line) && !hasBoxConnector; // │ indent only, no connector
      const hasListPrefix = /^\s*\*\s+/.test(line);
      const hasNodePrefix = hasBoxConnector || hasListPrefix;
      const stripped = line.replace(/[│├└─]/g, '').replace(/^\s*\*\s*/, '').trimStart();
      // Only offer if at start of node content (no partial op name mid-line)
      const wordStart = stripped.match(/^([A-Z_]*)$/);
      if (wordStart !== null) {
        const nodePrefix = hasNodePrefix ? '' : hasBoxIndent ? '├── ' : '* ';
        const items: vscode.CompletionItem[] = [];
        items.push(...this.primitiveCompletions(nodePrefix));
        const customOps = await registry.allOpNames(document.uri);
        for (const opName of customOps) {
          if (!isPrimitive(opName)) {
            const item = new vscode.CompletionItem(opName, vscode.CompletionItemKind.Function);
            item.detail = 'Custom op';
            if (nodePrefix) item.insertText = nodePrefix + opName;
            items.push(item);
          }
        }
        return items;
      }
    }

    return undefined;
  }

  private isInFrontmatter(document: vscode.TextDocument, position: vscode.Position): boolean {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') return false;
    for (let i = 1; i <= position.line; i++) {
      if (lines[i]?.trim() === '---') return false;
    }
    return true;
  }

  private getSectionAtLine(parsed: ReturnType<typeof parseDocument>, line: number): SectionKind {
    let last: SectionKind = 'preamble';
    for (const section of parsed.sections) {
      if (line >= section.startLine && line <= section.endLine) return section.kind;
      if (section.startLine <= line) last = section.kind;
    }
    return last;
  }

  private frontmatterCompletions(): vscode.CompletionItem[] {
    return FRONTMATTER_KEYS.map(key => {
      const item = new vscode.CompletionItem(key + ': ', vscode.CompletionItemKind.Field);
      item.detail = 'Frontmatter field';
      item.sortText = '0' + key;
      return item;
    });
  }

  private canopyFeatureCompletions(typedSoFar: string): vscode.CompletionItem[] {
    const alreadyListed = new Set(
      typedSoFar.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
    );
    return CANOPY_FEATURE_NAMES
      .filter(name => !alreadyListed.has(name))
      .map(name => {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.EnumMember);
        item.detail = 'Canopy primitive slice';
        item.documentation = new vscode.MarkdownString(
          `Slice \`${name}\` — declared in \`metadata.canopy-features\`. ` +
          `When listed, the runtime loads this primitive family. ` +
          `\`core\` is always loaded and must NOT be declared.`
        );
        return item;
      });
  }

  private sectionCompletions(): vscode.CompletionItem[] {
    return SECTION_NAMES.map(name => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
      item.detail = 'Canopy section';
      return item;
    });
  }

  private categoryCompletions(typed: string): vscode.CompletionItem[] {
    return CATEGORY_DIRS
      .filter(d => d.startsWith(typed))
      .map(dir => {
        const item = new vscode.CompletionItem(dir, vscode.CompletionItemKind.Folder);
        item.detail = 'Canopy resource directory';
        item.insertText = dir;
        return item;
      });
  }

  private primitiveCompletions(nodePrefix = ''): vscode.CompletionItem[] {
    return Object.values(PRIMITIVE_DOCS).map(doc => {
      const isControl = ['IF', 'ELSE_IF', 'ELSE', 'SWITCH', 'CASE', 'DEFAULT', 'FOR_EACH', 'PARALLEL', 'BREAK', 'END'].includes(doc.name);
      const kind = isControl ? vscode.CompletionItemKind.Keyword : vscode.CompletionItemKind.Function;
      const item = new vscode.CompletionItem(doc.name, kind);
      item.detail = doc.signature;
      item.documentation = new vscode.MarkdownString(
        `**${doc.signature}**\n\n${doc.description}\n\n\`\`\`\n${doc.example}\n\`\`\``
      );
      item.sortText = '1' + doc.name;
      if (nodePrefix) item.insertText = nodePrefix + doc.name;
      return item;
    });
  }
}
