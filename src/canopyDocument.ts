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
  opName?: string;
  isPrimitive?: boolean;
  hasInput: boolean;             // line contains <<
  hasOutput: boolean;            // line contains >>
  input?: string;                // trimmed content after <<
  output?: string;               // trimmed content after >>
  inputOutputReversed: boolean;  // >> appears before <<
  subagentCall?: boolean;        // op name was wrapped in ** (bold) — request subagent dispatch (S2)
}

export interface ReadRef {
  line: number;
  path: string;      // full backtick path, e.g. "schemas/foo.json"
  category: string;  // directory prefix including slash, e.g. "schemas/"
  colStart: number;
  colEnd: number;
}

export interface OpDefinition {
  name: string;
  signature: string;       // full ## OP_NAME << ... >> ... line text
  startLine: number;
  endLine: number;
  bodyText: string;
  sourceUri: vscode.Uri;
  // S2: subagent dispatch marker (`> **Subagent.** Output contract: <path>` blockquote
  // immediately under the heading). Absence of marker == inline op.
  isSubagent?: boolean;
  outputContract?: string; // schema path from `Output contract: <path>`
  inputContract?: string;  // optional schema path from `Input contract: <path>`
  markerLine?: number;     // line index of the `> **Subagent.**` line (for diagnostics)
}

export interface ParsedSkillDocument {
  uri: vscode.Uri;
  isOpsFile: boolean;
  isSkillFile: boolean;
  frontmatter: FrontmatterField[];
  metadataFields: FrontmatterField[]; // fields nested under `metadata:` block
  canopyFeatures?: string[];          // parsed from metadata.canopy-features (S2.5)
  canopyFeaturesLine?: number;        // line number for diagnostic anchoring
  sections: Section[];
  treeNodes: TreeNode[];
  opDefinitions: OpDefinition[];   // populated for ops.md, or the ## OP_NAME headers in skill.md context
  hasAgentSection: boolean;
  hasTreeSection: boolean;
  treeFirstOpName?: string;
}

// S2.5: feature slice names — matches `canopy-runtime/references/skill-resources.md`
// → "Per-skill manifest". `core` is implicit-always-loaded; never declared.
export type CanopyFeature =
  | 'interaction'
  | 'control-flow'
  | 'parallel'
  | 'subagent'
  | 'explore'
  | 'verify';

export const CANOPY_FEATURE_VALUES: ReadonlySet<CanopyFeature> = new Set<CanopyFeature>([
  'interaction', 'control-flow', 'parallel', 'subagent', 'explore', 'verify',
]);

const PRIMITIVES = new Set([
  'IF', 'ELSE_IF', 'ELSE', 'SWITCH', 'CASE', 'DEFAULT', 'FOR_EACH', 'PARALLEL',
  'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'
]);

const OP_PATTERN = /\b([A-Z][A-Z0-9_]{1,})\b/g;
const ALL_CAPS_SINGLE = /\b([A-Z][A-Z0-9_]{1,})\b/;

export function isPrimitive(name: string): boolean {
  return PRIMITIVES.has(name);
}

export function parseDocument(document: vscode.TextDocument): ParsedSkillDocument {
  const uri = document.uri;
  // agentskills.io spec requires SKILL.md (uppercase). We compare the basename
  // case-sensitively for SKILL.md but recognise lowercase ops.md and skill.md
  // for backward compatibility (legacy skills); diagnostics flag lowercase
  // skill.md as a compliance error.
  const rawName = path.basename(uri.fsPath);
  const fileNameLower = rawName.toLowerCase();
  const isOpsFile = fileNameLower === 'ops.md';
  const isSkillFile = rawName === 'SKILL.md' || fileNameLower === 'skill.md';

  const lines = document.getText().split(/\r?\n/);
  const result: ParsedSkillDocument = {
    uri,
    isOpsFile,
    isSkillFile,
    frontmatter: [],
    metadataFields: [],
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
    let inMetadataBlock = false;
    while (lineIdx < lines.length && lines[lineIdx]?.trim() !== '---') {
      const line = lines[lineIdx];
      const rootMatch = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
      const indentedMatch = line.match(/^\s+([a-z][a-z0-9-]*):\s*(.*)$/);
      if (rootMatch) {
        result.frontmatter.push({ key: rootMatch[1], value: rootMatch[2].trim(), line: lineIdx });
        // Entering or leaving the metadata block. `metadata:` with no value
        // (followed by indented children) opens a block. Any other root key
        // closes it.
        inMetadataBlock = rootMatch[1] === 'metadata' && rootMatch[2].trim() === '';
      } else if (inMetadataBlock && indentedMatch) {
        const value = indentedMatch[2].trim();
        result.metadataFields.push({
          key: indentedMatch[1],
          value,
          line: lineIdx,
        });
        // S2.5: extract `canopy-features` array. Values are bracketed,
        // comma-separated: `[interaction, verify]`. Empty list `[]` is valid
        // (declares the skill uses only `core`).
        if (indentedMatch[1] === 'canopy-features') {
          result.canopyFeaturesLine = lineIdx;
          const arrayMatch = value.match(/^\[(.*)\]$/);
          if (arrayMatch) {
            result.canopyFeatures = arrayMatch[1]
              .split(',')
              .map(v => v.trim().replace(/^["']|["']$/g, ''))
              .filter(v => v.length > 0);
          } else {
            // Malformed value (not a YAML flow-sequence). Record empty so
            // diagnostics can flag it; the line index is still captured.
            result.canopyFeatures = [];
          }
        }
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
  // Strip box-drawing chars then the list-bullet `*` — but only when followed
  // by whitespace (so the regex doesn't eat one of the `**` markers in
  // `**OP_NAME**` subagent-call syntax, S2).
  const stripped = line.replace(/[│├└─]/g, '').replace(/^\s*\*(?:\s|$)/, '').trim();
  if (!stripped) return null;
  const indent = line.search(/[^\s│├└─*\t]/);

  // S2: detect `**OP_NAME**` (bold-wrapped) at line start — subagent dispatch
  // request. Strip the `**` for the rest of parsing so input/output/op-name
  // extraction works uniformly with the inline form.
  const boldOpMatch = stripped.match(/^\*\*([A-Z][A-Z0-9_]{1,})\*\*(?=\s|<<|>>|$)/);
  const subagentCall = !!boldOpMatch;
  const normalized = subagentCall
    ? stripped.replace(/^\*\*([A-Z][A-Z0-9_]{1,})\*\*/, '$1')
    : stripped;

  const inputIdx = normalized.indexOf('<<');
  const outputIdx = normalized.indexOf('>>');
  const hasInput = inputIdx !== -1;
  const hasOutput = outputIdx !== -1;
  const inputOutputReversed = hasInput && hasOutput && outputIdx < inputIdx;

  let input: string | undefined;
  let output: string | undefined;
  if (hasInput && hasOutput && !inputOutputReversed) {
    input = normalized.slice(inputIdx + 2, outputIdx).trim();
    output = normalized.slice(outputIdx + 2).trim();
  } else if (hasInput) {
    input = normalized.slice(inputIdx + 2).trim();
  } else if (hasOutput) {
    output = normalized.slice(outputIdx + 2).trim();
  }

  // Op name lives before any << or >>
  const beforeOps = hasInput
    ? normalized.slice(0, inputIdx)
    : hasOutput ? normalized.slice(0, outputIdx) : normalized;
  const opMatch = beforeOps.trim().match(/^([A-Z][A-Z0-9_]{1,})\b/);

  const node: TreeNode = {
    line: lineIdx,
    text: stripped,
    indent: Math.max(indent, 0),
    hasInput,
    hasOutput,
    input,
    output,
    inputOutputReversed,
  };

  if (opMatch) {
    node.opName = opMatch[1];
    node.isPrimitive = isPrimitive(opMatch[1]);
  }

  if (subagentCall) {
    node.subagentCall = true;
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
      const bodyLineNumbers: number[] = [];
      while (i < lines.length && !lines[i].match(/^##\s+/)) {
        bodyLines.push(lines[i]);
        bodyLineNumbers.push(i);
        i++;
      }
      const def: OpDefinition = {
        name,
        signature,
        startLine,
        endLine: i - 1,
        bodyText: bodyLines.join('\n').trim(),
        sourceUri: uri,
      };

      // S2: detect subagent marker `> **Subagent.** Output contract: <path>` as the
      // first non-blank content under the heading. The marker may span multiple
      // blockquote lines (with `Inputs:` bullets and/or `Input contract:`).
      const markerInfo = parseSubagentMarker(bodyLines, bodyLineNumbers);
      if (markerInfo.isSubagent) {
        def.isSubagent = true;
        def.markerLine = markerInfo.markerLine;
        if (markerInfo.outputContract) def.outputContract = markerInfo.outputContract;
        if (markerInfo.inputContract) def.inputContract = markerInfo.inputContract;
      }

      defs.push(def);
    } else {
      i++;
    }
  }
  return defs;
}

interface SubagentMarkerInfo {
  isSubagent: boolean;
  markerLine?: number;
  outputContract?: string;
  inputContract?: string;
}

/**
 * Detect a subagent marker in an op body. The marker is a blockquote starting
 * with `> **Subagent.**` (or `> **Subagent**`) as the first non-blank line of
 * the body, and may span multiple consecutive blockquote lines carrying
 * `Output contract: \`<path>\`` and optionally `Input contract: \`<path>\``.
 */
function parseSubagentMarker(
  bodyLines: string[],
  bodyLineNumbers: number[],
): SubagentMarkerInfo {
  let firstNonBlankIdx = -1;
  for (let j = 0; j < bodyLines.length; j++) {
    if (bodyLines[j].trim()) {
      firstNonBlankIdx = j;
      break;
    }
  }
  if (firstNonBlankIdx < 0) return { isSubagent: false };

  const firstLine = bodyLines[firstNonBlankIdx].trim();
  if (!/^>\s+\*\*Subagent\.?\*\*/.test(firstLine)) {
    return { isSubagent: false };
  }

  // Collect consecutive blockquote lines starting at firstNonBlankIdx — that's
  // the marker block. Continue until a non-blockquote, non-blank line is hit.
  const markerText: string[] = [];
  for (let j = firstNonBlankIdx; j < bodyLines.length; j++) {
    const t = bodyLines[j].trim();
    if (t.startsWith('>')) {
      markerText.push(t);
    } else if (!t) {
      // blank line — stops the marker block (markdown blockquote rules vary,
      // but treating blank as terminator is the simple, predictable choice)
      break;
    } else {
      break;
    }
  }

  const joined = markerText.join('\n');
  const outputMatch = joined.match(/Output contract:\s*`([^`]+)`/);
  const inputMatch = joined.match(/Input contract:\s*`([^`]+)`/);

  return {
    isSubagent: true,
    markerLine: bodyLineNumbers[firstNonBlankIdx],
    outputContract: outputMatch?.[1],
    inputContract: inputMatch?.[1],
  };
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

/** Extract all Read `category/path` references from a document's lines. */
export function extractReadRefs(lines: string[]): ReadRef[] {
  const refs: ReadRef[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const re = /\bRead\s+`([^`]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const fullPath = m[1];
      const category = extractCategory(fullPath);
      const backtickStart = m.index + m[0].indexOf('`') + 1;
      refs.push({ line: i, path: fullPath, category, colStart: backtickStart, colEnd: backtickStart + fullPath.length });
    }
  }
  return refs;
}

/**
 * Extract the category prefix from a Read path. Supports both:
 *   - legacy flat layout — `constants/foo.md`     → `constants/`
 *   - agentskills layout — `assets/constants/foo.md` → `assets/constants/`
 *
 * Two-segment categories live under `assets/`. All other prefixes are
 * single-segment.
 */
function extractCategory(fullPath: string): string {
  const firstSlash = fullPath.indexOf('/');
  if (firstSlash === -1) return '';
  const firstSeg = fullPath.slice(0, firstSlash + 1);
  if (firstSeg === 'assets/') {
    const secondSlash = fullPath.indexOf('/', firstSlash + 1);
    if (secondSlash !== -1) {
      return fullPath.slice(0, secondSlash + 1);
    }
  }
  return firstSeg;
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

// ---------------------------------------------------------------------------
// S2.5 — Compute the set of canopy features actually used by a skill's tree
// + op definitions. Mapping mirrors `canopy-runtime/references/skill-resources.md`
// → "Per-skill manifest" / `canopy/references/ops/validate.md` step 3.
//
// Used by:
//   - diagnosticsProvider.checkCanopyFeaturesManifest (drift detection)
//   - completionProvider (no — completion uses the static valid-set)
// ---------------------------------------------------------------------------

/** Compute which `canopy-features` slices are used by the parsed skill. */
export function computeUsedFeatures(parsed: ParsedSkillDocument): Set<CanopyFeature> {
  const used = new Set<CanopyFeature>();

  // Tree-node primitive usage
  for (const node of parsed.treeNodes) {
    if (!node.opName) continue;
    if (node.subagentCall) {
      // `**OP_NAME**` (bold) — subagent dispatch
      used.add('subagent');
    }
    switch (node.opName) {
      case 'ASK':
      case 'SHOW_PLAN':
        used.add('interaction');
        break;
      case 'SWITCH':
      case 'CASE':
      case 'DEFAULT':
      case 'FOR_EACH':
        used.add('control-flow');
        break;
      case 'PARALLEL':
        used.add('parallel');
        break;
      case 'EXPLORE':
        used.add('explore');
        break;
      case 'VERIFY_EXPECTED':
        used.add('verify');
        break;
      // IF / ELSE_IF / ELSE / END / BREAK live in `core` — implicit, never declared
    }
  }

  // Legacy `## Agent` + `**explore**` is sugar for an EXPLORE subagent op
  if (parsed.hasAgentSection) {
    used.add('explore');
  }

  // Op definitions carrying the `> **Subagent.**` marker imply subagent dispatch
  for (const def of parsed.opDefinitions) {
    if (def.isSubagent) {
      used.add('subagent');
    }
  }

  return used;
}
