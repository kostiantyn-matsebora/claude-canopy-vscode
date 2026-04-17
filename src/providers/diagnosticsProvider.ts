import * as vscode from 'vscode';
import { parseDocument, isPrimitive, extractOpRefs } from '../canopyDocument';
import { registry } from '../opRegistry';

// Framework primitives must not be defined in skill or project ops
const RESERVED_PRIMITIVES = new Set([
  'IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'
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

    // -----------------------------------------------------------------------
    // skill.md checks
    // -----------------------------------------------------------------------
    if (parsed.isSkillFile) {
      // Must have ## Tree
      if (!parsed.hasTreeSection) {
        const range = new vscode.Range(0, 0, 0, lines[0]?.length ?? 0);
        diagnostics.push(new vscode.Diagnostic(
          range,
          'skill.md is missing a required ## Tree section.',
          vscode.DiagnosticSeverity.Error
        ));
      }

      // If ## Agent present, first op in tree must be EXPLORE
      if (parsed.hasAgentSection && parsed.hasTreeSection) {
        if (parsed.treeFirstOpName && parsed.treeFirstOpName !== 'EXPLORE') {
          // Find the line with the first op name
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
          // Tree exists but no op nodes at all
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

      // Check for inline JSON/YAML blocks (forbidden in skill.md)
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

      // Check unknown op references (configurable severity)
      const unknownSeverityStr = config.get<string>('unknownOps', 'warning');
      const unknownSeverity = this.parseSeverity(unknownSeverityStr);
      if (unknownSeverity !== undefined) {
        await this.checkUnknownOps(document, parsed, lines, diagnostics, unknownSeverity);
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

      // Warn on duplicate op names
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
    }

    this.collection.set(document.uri, diagnostics);
  }

  private async checkUnknownOps(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
    severity: vscode.DiagnosticSeverity,
  ): Promise<void> {
    const knownOps = new Set(await registry.allOpNames(document.uri));
    // Add primitives as known
    for (const p of ['IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE']) {
      knownOps.add(p);
    }

    const treeSection = parsed.sections.find(s => s.kind === 'tree');
    if (!treeSection) return;

    for (let i = treeSection.startLine; i <= treeSection.endLine; i++) {
      const line = lines[i] ?? '';
      // Skip lines inside code blocks
      if (line.trim().startsWith('```')) continue;
      const refs = extractOpRefs(line);
      for (const ref of refs) {
        if (!knownOps.has(ref)) {
          const col = line.indexOf(ref);
          const range = new vscode.Range(i, col, i, col + ref.length);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Unknown op '${ref}' — not found in skill-local, project, or framework ops.md.`,
            severity
          ));
        }
      }
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
