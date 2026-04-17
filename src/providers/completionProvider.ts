import * as vscode from 'vscode';
import { parseDocument, SectionKind, isPrimitive } from '../canopyDocument';
import { PRIMITIVE_DOCS, registry } from '../opRegistry';

const FRONTMATTER_KEYS = ['name', 'description', 'argument-hint'];
const SECTION_NAMES = ['Agent', 'Tree', 'Rules', 'Response:'];
const CATEGORY_DIRS = ['schemas/', 'templates/', 'commands/', 'constants/', 'policies/', 'verify/'];

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
      if (/^\s*$/.test(prefix) || /^[a-z-]*$/.test(prefix.trim())) {
        return this.frontmatterCompletions();
      }
    }

    // --- Section header names (after ##) ---
    if (/^##\s+\w*$/.test(prefix)) {
      return this.sectionCompletions();
    }

    // --- Read `category/...` completions ---
    const readCategoryMatch = prefix.match(/\bRead\s+`([a-z]*)$/);
    if (readCategoryMatch) {
      return this.categoryCompletions(readCategoryMatch[1]);
    }

    // --- Verify path after VERIFY_EXPECTED ---
    const verifyMatch = prefix.match(/\bVERIFY_EXPECTED\s+<<\s+verify\/(\w*)$/);
    if (verifyMatch) {
      return []; // could list verify/ files — skipped for now
    }

    // --- Tree node completions: op names and primitives ---
    const currentSection = this.getSectionAtLine(parsed, position.line);
    if (currentSection === 'tree' || parsed.isOpsFile) {
      const stripped = line.replace(/[│├└─]/g, '').replace(/^\s*\*\s*/, '').trimStart();
      // Only offer if at start of node content (no partial op name mid-line)
      const wordStart = stripped.match(/^([A-Z_]*)$/);
      if (wordStart !== null) {
        const items: vscode.CompletionItem[] = [];
        items.push(...this.primitiveCompletions());
        const customOps = await registry.allOpNames(document.uri);
        for (const opName of customOps) {
          if (!isPrimitive(opName)) {
            const item = new vscode.CompletionItem(opName, vscode.CompletionItemKind.Function);
            item.detail = 'Custom op';
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

  private primitiveCompletions(): vscode.CompletionItem[] {
    return Object.values(PRIMITIVE_DOCS).map(doc => {
      const isControl = ['IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END'].includes(doc.name);
      const kind = isControl ? vscode.CompletionItemKind.Keyword : vscode.CompletionItemKind.Function;
      const item = new vscode.CompletionItem(doc.name, kind);
      item.detail = doc.signature;
      item.documentation = new vscode.MarkdownString(
        `**${doc.signature}**\n\n${doc.description}\n\n\`\`\`\n${doc.example}\n\`\`\``
      );
      item.sortText = '1' + doc.name;
      return item;
    });
  }
}
