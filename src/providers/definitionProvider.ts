import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getOpNameAtPosition, isPrimitive } from '../canopyDocument';
import { registry } from '../opRegistry';

/** Walk up from a file path until a directory containing SKILL.md is found. */
function walkToSkillRoot(startPath: string): string | undefined {
  let current = path.dirname(startPath);
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, 'SKILL.md')) ||
        fs.existsSync(path.join(current, 'skill.md'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

export class CanopyDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Definition | undefined> {
    const line = document.lineAt(position).text;

    // --- Go to op definition ---
    const opName = getOpNameAtPosition(line, position.character);
    if (opName && !isPrimitive(opName)) {
      const resolved = await registry.resolve(opName, document.uri);
      if (resolved) {
        const { definition } = resolved;
        const targetRange = new vscode.Range(
          definition.startLine, 0,
          definition.startLine, definition.signature.length
        );
        return new vscode.Location(definition.sourceUri, targetRange);
      }
    }

    // --- Go to Read `category/file` target ---
    const readMatch = line.match(/\bRead\s+`([^`]+)`/);
    if (readMatch) {
      const relPath = readMatch[1];
      // Character range of the path
      const pathStart = line.indexOf(relPath);
      const pathEnd = pathStart + relPath.length;
      if (position.character >= pathStart && position.character <= pathEnd) {
        const skillDir = path.dirname(document.uri.fsPath);
        const target = path.join(skillDir, relPath);
        if (fs.existsSync(target)) {
          return new vscode.Location(
            vscode.Uri.file(target),
            new vscode.Position(0, 0)
          );
        }
      }
    }

    // --- Go to subagent marker schema reference ---
    // `> **Subagent.** Output contract: \`<path>\`` or `Input contract: \`<path>\``
    // Schema paths in the marker resolve relative to the skill root, walking up
    // from the ops file (which typically lives at `<skill>/references/ops.md`
    // or `<skill>/references/ops/<name>.md`).
    const subagentMarker = line.match(/^>\s+\*\*Subagent\.?\*\*/);
    const contractMatch = line.match(/(?:Output|Input) contract:\s*`([^`]+)`/);
    if ((subagentMarker || /(?:Output|Input) contract:/.test(line)) && contractMatch) {
      const relPath = contractMatch[1];
      const pathStart = line.indexOf('`' + relPath + '`') + 1;
      const pathEnd = pathStart + relPath.length;
      if (position.character >= pathStart && position.character <= pathEnd) {
        const skillRoot = walkToSkillRoot(document.uri.fsPath);
        const refRoot = skillRoot ?? path.dirname(document.uri.fsPath);
        const target = path.join(refRoot, relPath);
        if (fs.existsSync(target)) {
          return new vscode.Location(
            vscode.Uri.file(target),
            new vscode.Position(0, 0)
          );
        }
      }
    }

    // --- Go to VERIFY_EXPECTED file ---
    // Standard layout uses 'assets/verify/'; legacy layout uses 'verify/' at skill root.
    const verifyMatch = line.match(/\bVERIFY_EXPECTED\s+<<\s+((?:assets\/)?verify\/[^\s]+\.md)/);
    if (verifyMatch) {
      const relPath = verifyMatch[1];
      const pathStart = line.indexOf(relPath);
      const pathEnd = pathStart + relPath.length;
      if (position.character >= pathStart && position.character <= pathEnd) {
        const skillDir = path.dirname(document.uri.fsPath);
        const target = path.join(skillDir, relPath);
        if (fs.existsSync(target)) {
          return new vscode.Location(
            vscode.Uri.file(target),
            new vscode.Position(0, 0)
          );
        }
        // Backward-compatible fallback: if user wrote `verify/...`, try `assets/verify/...`,
        // and vice versa.
        const altPath = relPath.startsWith('assets/')
          ? relPath.slice('assets/'.length)
          : 'assets/' + relPath;
        const altTarget = path.join(skillDir, altPath);
        if (fs.existsSync(altTarget)) {
          return new vscode.Location(
            vscode.Uri.file(altTarget),
            new vscode.Position(0, 0)
          );
        }
      }
    }

    return undefined;
  }
}
