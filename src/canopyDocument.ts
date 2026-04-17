import * as vscode from 'vscode';
import * as path from 'path';

export type SectionKind = 'frontmatter' | 'preamble' | 'agent' | 'tree' | 'rules' | 'response' | 'unknown';

export interface FrontmatterField {
  key: string;
  value: string;
  line: number;
}

export interface Section {
  kind: SectionKind;
  startLine: number;
  endLine: number;
  content: string;
}

export interface TreeNode {
  line: number;
  text: string;
  indent: number;
  opName?: string;         // ALL_CAPS identifier if present
  isPrimitive?: boolean;
}

export interface OpDefinition {
  name: string;
  signature: string;       // full ## OP_NAME << ... >> ... line text
  startLine: number;
  endLine: number;
  bodyText: string;
  sourceUri: vscode.Uri;
}

export interface ParsedSkillDocument {
  uri: vscode.Uri;
  isOpsFile: boolean;
  isSkillFile: boolean;
  frontmatter: FrontmatterField[];
  sections: Section[];
  treeNodes: TreeNode[];
  opDefinitions: OpDefinition[];   // populated for ops.md, or the ## OP_NAME headers in skill.md context
  hasAgentSection: boolean;
  hasTreeSection: boolean;
  treeFirstOpName?: string;
}

const PRIMITIVES = new Set([
  'IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'
]);

const OP_PATTERN = /\b([A-Z][A-Z0-9_]{1,})\b/g;
const ALL_CAPS_SINGLE = /\b([A-Z][A-Z0-9_]{1,})\b/;

export function isPrimitive(name: string): boolean {
  return PRIMITIVES.has(name);
}

export function parseDocument(document: vscode.TextDocument): ParsedSkillDocument {
  const uri = document.uri;
  const fileName = path.basename(uri.fsPath);
  const isOpsFile = fileName === 'ops.md';
  const isSkillFile = fileName === 'skill.md';

  const lines = document.getText().split(/\r?\n/);
  const result: ParsedSkillDocument = {
    uri,
    isOpsFile,
    isSkillFile,
    frontmatter: [],
    sections: [],
    treeNodes: [],
    opDefinitions: [],
    hasAgentSection: false,
    hasTreeSection: false,
  };

  // --- Parse frontmatter ---
  let lineIdx = 0;
  if (lines[0]?.trim() === '---') {
    lineIdx = 1;
    while (lineIdx < lines.length && lines[lineIdx]?.trim() !== '---') {
      const match = lines[lineIdx].match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
      if (match) {
        result.frontmatter.push({ key: match[1], value: match[2].trim(), line: lineIdx });
      }
      lineIdx++;
    }
    lineIdx++; // skip closing ---
  }

  // --- Parse sections ---
  let currentSectionKind: SectionKind = 'preamble';
  let currentSectionStart = lineIdx;
  const sectionLines: string[] = [];

  const flushSection = (endLine: number) => {
    if (endLine > currentSectionStart) {
      result.sections.push({
        kind: currentSectionKind,
        startLine: currentSectionStart,
        endLine,
        content: sectionLines.join('\n'),
      });
    }
    sectionLines.length = 0;
  };

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);

    if (line.trim() === '---') {
      // preamble separator
      flushSection(lineIdx);
      currentSectionKind = 'preamble';
      currentSectionStart = lineIdx + 1;
      lineIdx++;
      continue;
    }

    if (sectionMatch) {
      flushSection(lineIdx);
      const heading = sectionMatch[1];
      if (heading === 'Agent') {
        currentSectionKind = 'agent';
        result.hasAgentSection = true;
      } else if (heading === 'Tree') {
        currentSectionKind = 'tree';
        result.hasTreeSection = true;
      } else if (heading === 'Rules') {
        currentSectionKind = 'rules';
      } else if (heading.startsWith('Response')) {
        currentSectionKind = 'response';
      } else {
        currentSectionKind = 'unknown';
      }
      currentSectionStart = lineIdx + 1;
      lineIdx++;
      continue;
    }

    sectionLines.push(line);

    // Collect tree nodes
    if (currentSectionKind === 'tree') {
      const node = parseTreeLine(line, lineIdx);
      if (node) {
        result.treeNodes.push(node);
      }
    }

    lineIdx++;
  }

  flushSection(lineIdx);

  // --- Parse op definitions (for ops.md or any ## OP_NAME headers) ---
  result.opDefinitions = parseOpDefinitions(lines, uri);

  // First tree op name
  if (result.treeNodes.length > 0) {
    // Skip the root skill-name node (first node, no op name usually)
    for (const node of result.treeNodes) {
      if (node.opName) {
        result.treeFirstOpName = node.opName;
        break;
      }
    }
  }

  return result;
}

function parseTreeLine(line: string, lineIdx: number): TreeNode | null {
  // Strip tree drawing chars and list bullets
  const stripped = line.replace(/[│├└─]/g, '').replace(/^\s*\*\s*/, '').trim();
  if (!stripped) return null;
  // Compute indent from original line (count leading spaces/tabs + tree chars)
  const indent = line.search(/[^\s│├└─*\t]/);

  const node: TreeNode = { line: lineIdx, text: stripped, indent: Math.max(indent, 0) };

  const opMatch = stripped.match(/^([A-Z][A-Z0-9_]{1,})\b/);
  if (opMatch) {
    node.opName = opMatch[1];
    node.isPrimitive = isPrimitive(opMatch[1]);
  }

  return node;
}

export function parseOpDefinitions(lines: string[], uri: vscode.Uri): OpDefinition[] {
  const defs: OpDefinition[] = [];
  let i = 0;
  while (i < lines.length) {
    // ## OP_NAME ... (must have ALL_CAPS name, not just any ## heading)
    const headerMatch = lines[i].match(/^##\s+([A-Z][A-Z0-9_]{1,})(.*)?$/);
    if (headerMatch) {
      const name = headerMatch[1];
      const signature = lines[i];
      const startLine = i;
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && !lines[i].match(/^##\s+/)) {
        bodyLines.push(lines[i]);
        i++;
      }
      defs.push({
        name,
        signature,
        startLine,
        endLine: i - 1,
        bodyText: bodyLines.join('\n').trim(),
        sourceUri: uri,
      });
    } else {
      i++;
    }
  }
  return defs;
}

/** Extract all ALL_CAPS op name references from a line (excluding primitives optionally). */
export function extractOpRefs(line: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(OP_PATTERN.source, 'g');
  while ((match = re.exec(line)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/** Get the ALL_CAPS word at a given position in a line, if any. */
export function getOpNameAtPosition(line: string, character: number): string | undefined {
  const re = new RegExp(ALL_CAPS_SINGLE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[1].length;
    if (character >= start && character <= end) {
      return match[1];
    }
  }
  return undefined;
}
