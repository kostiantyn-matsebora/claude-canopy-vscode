import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseDocument, isPrimitive, extractReadRefs } from '../canopyDocument';
import { registry } from '../opRegistry';

const RESERVED_PRIMITIVES = new Set([
  'IF', 'ELSE_IF', 'ELSE', 'SWITCH', 'CASE', 'DEFAULT', 'FOR_EACH',
  'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'
]);

const FRONTMATTER_REQUIRED = ['name', 'description'];
const FRONTMATTER_ALLOWED = new Set([
  'name', 'description', 'argument-hint',
  'license', 'allowed-tools', 'metadata', 'user-invocable',
]);
const VALID_CATEGORIES = new Set([
  'schemas/', 'templates/', 'commands/', 'constants/',
  'policies/', 'verify/', 'checklists/', 'references/',
]);

export class CanopyDiagnosticsProvider {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('canopy');
  }

  async validate(document: vscode.TextDocument): Promise<void> {
    const config = vscode.workspace.getConfiguration('canopy.validate');
    if (!config.get<boolean>('enabled', true)) {
      this.collection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const parsed = parseDocument(document);
    const lines = document.getText().split(/\r?\n/);
    const skillDir = path.dirname(document.uri.fsPath);

    // -----------------------------------------------------------------------
    // skill.md checks
    // -----------------------------------------------------------------------
    if (parsed.isSkillFile) {
      this.checkFrontmatter(parsed, lines, diagnostics);

      if (!parsed.hasTreeSection) {
        const range = new vscode.Range(0, 0, 0, lines[0]?.length ?? 0);
        diagnostics.push(new vscode.Diagnostic(
          range,
          'skill.md is missing a required ## Tree section.',
          vscode.DiagnosticSeverity.Error
        ));
      }

      if (parsed.hasAgentSection && parsed.hasTreeSection) {
        if (parsed.treeFirstOpName && parsed.treeFirstOpName !== 'EXPLORE') {
          const firstOpLine = parsed.treeNodes.find(n => n.opName)?.line;
          if (firstOpLine !== undefined) {
            const range = new vscode.Range(firstOpLine, 0, firstOpLine, lines[firstOpLine]?.length ?? 0);
            diagnostics.push(new vscode.Diagnostic(
              range,
              `When ## Agent is declared, the first tree op must be EXPLORE, but found '${parsed.treeFirstOpName}'.`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
        }
        if (!parsed.treeFirstOpName) {
          const agentSection = parsed.sections.find(s => s.kind === 'agent');
          if (agentSection) {
            const range = new vscode.Range(agentSection.startLine, 0, agentSection.startLine, 0);
            diagnostics.push(new vscode.Diagnostic(
              range,
              '## Agent is declared but ## Tree has no EXPLORE node.',
              vscode.DiagnosticSeverity.Warning
            ));
          }
        }
      }

      const treeSection = parsed.sections.find(s => s.kind === 'tree');
      if (treeSection) {
        let inCodeBlock = false;
        for (let i = treeSection.startLine; i <= treeSection.endLine; i++) {
          const l = lines[i] ?? '';
          if (l.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            if (inCodeBlock) {
              const range = new vscode.Range(i, 0, i, l.length);
              diagnostics.push(new vscode.Diagnostic(
                range,
                'skill.md should not contain inline code blocks in the Tree section. Move structured content to category resource files.',
                vscode.DiagnosticSeverity.Warning
              ));
            }
          }
        }
      }

      this.checkTreeNodeSyntax(parsed, lines, diagnostics);
      this.checkPrimitiveSignatures(parsed, lines, diagnostics);
      this.checkResourceRefs(parsed, lines, diagnostics, skillDir);

      const unknownSeverityStr = config.get<string>('unknownOps', 'warning');
      const unknownSeverity = this.parseSeverity(unknownSeverityStr);
      if (unknownSeverity !== undefined) {
        await this.checkUnknownOps(document, parsed, lines, diagnostics, unknownSeverity);
      }

      if (config.get<boolean>('opConformance', true)) {
        await this.checkCustomOpConformance(document, parsed, lines, diagnostics);
      }
    }

    // -----------------------------------------------------------------------
    // ops.md checks
    // -----------------------------------------------------------------------
    if (parsed.isOpsFile) {
      for (const def of parsed.opDefinitions) {
        if (RESERVED_PRIMITIVES.has(def.name)) {
          const range = new vscode.Range(def.startLine, 0, def.startLine, lines[def.startLine]?.length ?? 0);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `'${def.name}' is a framework primitive and cannot be redefined in ops.md.`,
            vscode.DiagnosticSeverity.Error
          ));
        }
      }

      const seen = new Map<string, number>();
      for (const def of parsed.opDefinitions) {
        if (seen.has(def.name)) {
          const range = new vscode.Range(def.startLine, 0, def.startLine, lines[def.startLine]?.length ?? 0);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Duplicate op definition '${def.name}'. Previously defined at line ${(seen.get(def.name) ?? 0) + 1}.`,
            vscode.DiagnosticSeverity.Warning
          ));
        } else {
          seen.set(def.name, def.startLine);
        }
      }

      for (const def of parsed.opDefinitions) {
        if (!def.bodyText.trim()) {
          const range = new vscode.Range(def.startLine, 0, def.startLine, lines[def.startLine]?.length ?? 0);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Op '${def.name}' has an empty body — add implementation steps.`,
            vscode.DiagnosticSeverity.Warning
          ));
        }
      }

      this.checkResourceRefs(parsed, lines, diagnostics, skillDir);
    }

    this.collection.set(document.uri, diagnostics);
  }

  // -------------------------------------------------------------------------
  // Frontmatter
  // -------------------------------------------------------------------------

  private checkFrontmatter(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    for (const key of FRONTMATTER_REQUIRED) {
      const field = parsed.frontmatter.find(f => f.key === key);
      if (!field) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, lines[0]?.length ?? 0),
          `Missing required frontmatter field: '${key}'.`,
          vscode.DiagnosticSeverity.Error
        ));
      } else if (!field.value) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(field.line, 0, field.line, lines[field.line]?.length ?? 0),
          `Frontmatter field '${key}' is empty.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }

    for (const field of parsed.frontmatter) {
      if (!FRONTMATTER_ALLOWED.has(field.key)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(field.line, 0, field.line, lines[field.line]?.length ?? 0),
          `Unknown frontmatter field '${field.key}'. Allowed: ${[...FRONTMATTER_ALLOWED].join(', ')}.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tree node << >> syntax
  // -------------------------------------------------------------------------

  private checkTreeNodeSyntax(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    for (const node of parsed.treeNodes) {
      if (!node.opName) continue;
      const line = lines[node.line] ?? '';

      if (node.inputOutputReversed) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, 0, node.line, line.length),
          `'>>' (output) appears before '<<' (input). Correct order: OP_NAME << input >> output.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }

      if (node.hasInput && node.input === '') {
        const col = line.indexOf('<<');
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, col, node.line, col + 2),
          `'<<' operator has no content after it.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }

      if (node.hasOutput && node.output === '') {
        const col = line.indexOf('>>');
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, col, node.line, col + 2),
          `'>>' operator has no content after it.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Primitive signature conformance
  // -------------------------------------------------------------------------

  private checkPrimitiveSignatures(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    for (const node of parsed.treeNodes) {
      if (!node.isPrimitive || !node.opName) continue;
      const line = lines[node.line] ?? '';
      const range = new vscode.Range(node.line, 0, node.line, line.length);

      switch (node.opName) {
        case 'IF':
        case 'ELSE_IF':
          if (!node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'${node.opName}' requires a condition: '${node.opName} << condition'.`,
              vscode.DiagnosticSeverity.Error
            ));
          }
          break;

        case 'ELSE':
        case 'BREAK':
        case 'DEFAULT':
          if (node.hasInput || node.hasOutput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'${node.opName}' takes no operators — remove '<<' / '>>' from this node.`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
          break;

        case 'SWITCH':
        case 'CASE':
        case 'FOR_EACH':
          if (!node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'${node.opName}' requires an input: '${node.opName} << ${node.opName === 'FOR_EACH' ? 'item in collection' : node.opName === 'SWITCH' ? 'expression' : 'value'}'.`,
              vscode.DiagnosticSeverity.Error
            ));
          }
          break;

        case 'ASK':
          if (!node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'ASK' requires: 'ASK << question | option1 | option2'.`,
              vscode.DiagnosticSeverity.Error
            ));
          } else if (node.input && !node.input.includes('|')) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'ASK' requires at least one option separated by '|': 'ASK << question | option'.`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
          break;

        case 'SHOW_PLAN':
          if (!node.hasOutput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'SHOW_PLAN' requires output fields: 'SHOW_PLAN >> field1 | field2'.`,
              vscode.DiagnosticSeverity.Error
            ));
          }
          if (node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'SHOW_PLAN' does not take an input operator ('<<').`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
          break;

        case 'VERIFY_EXPECTED':
          if (!node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'VERIFY_EXPECTED' requires a path: 'VERIFY_EXPECTED << verify/<file>.md'.`,
              vscode.DiagnosticSeverity.Error
            ));
          } else if (node.input && !node.input.startsWith('verify/')) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'VERIFY_EXPECTED' path must start with 'verify/': found '${node.input}'.`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
          break;

        case 'EXPLORE':
          if (!node.hasOutput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'EXPLORE' requires an output binding: 'EXPLORE >> context'.`,
              vscode.DiagnosticSeverity.Warning
            ));
          }
          break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Resource reference validation (Read `` and VERIFY_EXPECTED paths)
  // -------------------------------------------------------------------------

  private checkResourceRefs(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
    skillDir: string,
  ): void {
    for (const ref of extractReadRefs(lines)) {
      if (!ref.category) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(ref.line, ref.colStart, ref.line, ref.colEnd),
          `Resource path '${ref.path}' has no category directory. Expected one of: ${[...VALID_CATEGORIES].join(', ')}.`,
          vscode.DiagnosticSeverity.Warning
        ));
        continue;
      }
      if (!VALID_CATEGORIES.has(ref.category)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(ref.line, ref.colStart, ref.line, ref.colEnd),
          `Unknown resource category '${ref.category}'. Valid categories: ${[...VALID_CATEGORIES].join(', ')}.`,
          vscode.DiagnosticSeverity.Warning
        ));
        continue;
      }
      if (!fs.existsSync(path.join(skillDir, ref.path))) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(ref.line, ref.colStart, ref.line, ref.colEnd),
          `Resource file '${ref.path}' not found relative to skill directory.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }

    // VERIFY_EXPECTED file existence (cross-check after syntax is validated above)
    for (const node of parsed.treeNodes) {
      if (node.opName !== 'VERIFY_EXPECTED' || !node.hasInput || !node.input?.startsWith('verify/')) continue;
      if (!fs.existsSync(path.join(skillDir, node.input))) {
        const line = lines[node.line] ?? '';
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, 0, node.line, line.length),
          `VERIFY_EXPECTED file '${node.input}' not found.`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Custom op signature conformance (hints)
  // -------------------------------------------------------------------------

  private async checkCustomOpConformance(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): Promise<void> {
    for (const node of parsed.treeNodes) {
      if (!node.opName || node.isPrimitive) continue;
      const resolved = await registry.resolve(node.opName, document.uri);
      if (!resolved) continue;

      const sig = resolved.definition.signature;
      const sigHasInput = sig.includes('<<');
      const sigHasOutput = sig.includes('>>');
      const line = lines[node.line] ?? '';
      const range = new vscode.Range(node.line, 0, node.line, line.length);

      if (sigHasInput && !node.hasInput) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `Op '${node.opName}' expects input ('<<') per its signature: '${sig}'.`,
          vscode.DiagnosticSeverity.Hint
        ));
      }
      if (sigHasOutput && !node.hasOutput) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `Op '${node.opName}' produces output ('>>') per its signature: '${sig}'.`,
          vscode.DiagnosticSeverity.Hint
        ));
      }
      if (!sigHasInput && node.hasInput) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `Op '${node.opName}' does not declare input ('<<') in its signature: '${sig}'.`,
          vscode.DiagnosticSeverity.Hint
        ));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Unknown ops (uses treeNodes to avoid false-positives in << >> content)
  // -------------------------------------------------------------------------

  private async checkUnknownOps(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
    severity: vscode.DiagnosticSeverity,
  ): Promise<void> {
    const knownOps = new Set(await registry.allOpNames(document.uri));
    for (const p of RESERVED_PRIMITIVES) knownOps.add(p);

    for (const node of parsed.treeNodes) {
      if (!node.opName || knownOps.has(node.opName)) continue;
      const line = lines[node.line] ?? '';
      const col = line.indexOf(node.opName);
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(node.line, col, node.line, col + node.opName.length),
        `Unknown op '${node.opName}' — not found in skill-local, project, or framework ops.md.`,
        severity
      ));
    }
  }

  private parseSeverity(s: string): vscode.DiagnosticSeverity | undefined {
    switch (s) {
      case 'error': return vscode.DiagnosticSeverity.Error;
      case 'warning': return vscode.DiagnosticSeverity.Warning;
      case 'hint': return vscode.DiagnosticSeverity.Hint;
      case 'none': return undefined;
      default: return vscode.DiagnosticSeverity.Warning;
    }
  }

  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  dispose(): void {
    this.collection.dispose();
  }
}
