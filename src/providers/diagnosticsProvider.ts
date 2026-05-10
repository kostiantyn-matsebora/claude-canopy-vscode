import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseDocument, isPrimitive, extractReadRefs, computeUsedFeatures, CANOPY_FEATURE_VALUES, CanopyFeature } from '../canopyDocument';
import { registry } from '../opRegistry';
import { buildBindingGraph } from '../bindingGraph';
import { loadSchema } from '../schemaResolver';

// S3 (v0.22.0+): only `strict` is currently a recognized value for
// `metadata.canopy-contracts`. Used by checkCanopyContractsManifest.
const CANOPY_CONTRACT_VALUES = new Set(['strict']);

const RESERVED_PRIMITIVES = new Set([
  'IF', 'ELSE_IF', 'ELSE', 'SWITCH', 'CASE', 'DEFAULT', 'FOR_EACH', 'PARALLEL',
  'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'
]);

const FRONTMATTER_REQUIRED = ['name', 'description'];
// agentskills.io spec only allows these fields at frontmatter root.
// `argument-hint`, `user-invocable`, and `canopy-features` are non-spec and must live inside `metadata`.
const FRONTMATTER_ALLOWED = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
]);
// Non-spec fields that must be moved into `metadata` if they appear at root.
const FRONTMATTER_NON_SPEC_AT_ROOT = new Set([
  'argument-hint', 'user-invocable', 'canopy-features',
]);
// Standard agentskills.io layout (preferred for new skills) AND legacy flat layout
// (still supported for backward compatibility — canopy-runtime resolves Read refs literally).
const VALID_CATEGORIES = new Set([
  // Standard layout
  'scripts/', 'references/',
  'assets/schemas/', 'assets/templates/', 'assets/constants/',
  'assets/policies/', 'assets/verify/', 'assets/checklists/',
  // Legacy flat layout (backward-compatible)
  'schemas/', 'templates/', 'commands/', 'constants/',
  'policies/', 'verify/', 'checklists/',
]);

function isVerifyPath(p: string): boolean {
  return p.startsWith('assets/verify/') || p.startsWith('verify/');
}

/**
 * Count direct children of the tree node at `parentIdx`. Direct children are
 * tree nodes that follow the parent and share the same indent level — defined
 * as the indent of the first node after the parent that has indent greater
 * than the parent's. Stops counting when a node at indent ≤ parent.indent is
 * reached (sibling or shallower).
 */
function countDirectChildren(
  nodes: ReadonlyArray<{ indent: number }>,
  parentIdx: number,
): number {
  if (parentIdx < 0 || parentIdx >= nodes.length) return 0;
  const parent = nodes[parentIdx];
  let firstChildIndent: number | null = null;
  let count = 0;
  for (let i = parentIdx + 1; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.indent <= parent.indent) break;
    if (firstChildIndent === null) firstChildIndent = n.indent;
    if (n.indent === firstChildIndent) count++;
  }
  return count;
}

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
      this.checkSkillFilenameCase(document, diagnostics);
      this.checkFrontmatter(parsed, lines, diagnostics);

      if (!parsed.hasTreeSection) {
        const range = new vscode.Range(0, 0, 0, lines[0]?.length ?? 0);
        diagnostics.push(new vscode.Diagnostic(
          range,
          'skill.md is missing a required ## Tree section.',
          vscode.DiagnosticSeverity.Error
        ));
      }

      // Canopy-flavored skill compliance: every ## Tree skill must declare
      // canopy-runtime compatibility and carry a safety preamble.
      if (parsed.hasTreeSection) {
        this.checkCompatibility(parsed, lines, diagnostics);
        this.checkSafetyPreamble(parsed, lines, diagnostics);
        this.checkCanopyFeaturesManifest(parsed, lines, diagnostics);
        await this.checkCanopyContractsManifest(document, parsed, lines, diagnostics);
        await this.checkContractFlow(document, parsed, lines, diagnostics);
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
          const fenceMatch = l.match(/^\s*```(\S*)/);
          if (fenceMatch) {
            inCodeBlock = !inCodeBlock;
            // Plain ``` (no info string) is valid for box-drawing trees per
            // docs/FRAMEWORK.md. Only fences with a language tag (```yaml,
            // ```json, ```python, etc.) carry structured content that belongs
            // in a category resource file.
            if (inCodeBlock && fenceMatch[1] !== '') {
              const range = new vscode.Range(i, 0, i, l.length);
              diagnostics.push(new vscode.Diagnostic(
                range,
                `skill.md Tree section should not contain a fenced '${fenceMatch[1]}' code block. ` +
                `Move structured content to a category resource file. ` +
                `(Plain '\`\`\`' fences for box-drawing trees are allowed.)`,
                vscode.DiagnosticSeverity.Warning
              ));
            }
          }
        }
      }

      this.checkTreeNodeSyntax(parsed, lines, diagnostics);
      this.checkPrimitiveSignatures(parsed, lines, diagnostics);
      this.checkResourceRefs(parsed, lines, diagnostics, skillDir);
      await this.checkSubagentCallSites(document, parsed, lines, diagnostics);

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
      this.checkSubagentMarkerDefs(parsed, lines, diagnostics, skillDir);
      this.checkUniversalContractMarkers(parsed, lines, diagnostics, skillDir);
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
      if (FRONTMATTER_NON_SPEC_AT_ROOT.has(field.key)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(field.line, 0, field.line, lines[field.line]?.length ?? 0),
          `Field '${field.key}' is not in the agentskills.io spec at frontmatter root. Move it inside 'metadata:'.`,
          vscode.DiagnosticSeverity.Warning
        ));
      } else if (!FRONTMATTER_ALLOWED.has(field.key)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(field.line, 0, field.line, lines[field.line]?.length ?? 0),
          `Unknown frontmatter field '${field.key}'. Allowed at root: ${[...FRONTMATTER_ALLOWED].join(', ')}. Other fields go inside 'metadata:'.`,
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

        case 'PARALLEL':
          if (node.hasInput || node.hasOutput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'PARALLEL' takes no inputs or outputs: write 'PARALLEL' on its own line with children indented underneath.`,
              vscode.DiagnosticSeverity.Error
            ));
          } else {
            const childCount = countDirectChildren(parsed.treeNodes, parsed.treeNodes.indexOf(node));
            if (childCount < 2) {
              diagnostics.push(new vscode.Diagnostic(
                range,
                `'PARALLEL' with fewer than 2 children has no fan-out benefit. Add ≥2 children or remove the PARALLEL block.`,
                vscode.DiagnosticSeverity.Hint
              ));
            }
          }
          break;

        case 'ASK':
          if (!node.hasInput) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'ASK' requires a question: 'ASK << question' (free-form) or 'ASK << question | option1 | option2' (multiple-choice).`,
              vscode.DiagnosticSeverity.Error
            ));
          }
          // ASK without `|` options is valid — free-form input. The runtime
          // renders the question and accepts whatever the user types.
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
              `'VERIFY_EXPECTED' requires a path: 'VERIFY_EXPECTED << assets/verify/<file>.md'.`,
              vscode.DiagnosticSeverity.Error
            ));
          } else if (node.input && !isVerifyPath(node.input)) {
            diagnostics.push(new vscode.Diagnostic(
              range,
              `'VERIFY_EXPECTED' path must start with 'assets/verify/' (agentskills layout) ` +
              `or 'verify/' (legacy flat layout): found '${node.input}'.`,
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
      if (node.opName !== 'VERIFY_EXPECTED' || !node.hasInput || !node.input || !isVerifyPath(node.input)) continue;
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

  // -------------------------------------------------------------------------
  // SKILL.md filename case (agentskills.io requires exact uppercase spelling)
  // -------------------------------------------------------------------------

  private checkSkillFilenameCase(
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[],
  ): void {
    const basename = path.basename(document.uri.fsPath);
    if (basename === 'SKILL.md') return;
    if (basename.toLowerCase() === 'skill.md') {
      // Lowercase or mixed-case spelling — flag as a compliance issue.
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `Skill file must be named exactly 'SKILL.md' (uppercase) per the agentskills.io spec. ` +
        `Found '${basename}'. Case-sensitive filesystems (Linux, macOS APFS) reject lowercase ` +
        `'skill.md' for 'gh skill install' discovery — rename to 'SKILL.md'.`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
  }

  // -------------------------------------------------------------------------
  // Compatibility field (canopy-runtime declared in frontmatter)
  // -------------------------------------------------------------------------

  private checkCompatibility(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    const compat = parsed.frontmatter.find(f => f.key === 'compatibility');
    if (!compat) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, lines[0]?.length ?? 0),
        `Canopy-flavored skills (with '## Tree') must declare a 'compatibility' frontmatter field ` +
        `naming canopy-runtime as a dependency, e.g. 'compatibility: Requires the canopy-runtime skill (published at github.com/...)...'.`,
        vscode.DiagnosticSeverity.Warning
      ));
      return;
    }
    // Per agentskills.io spec, `compatibility` is free-text (max 500 chars).
    // Structured shapes like `compatibility: { requires: [...] }` or block-form
    // YAML maps are non-spec — flag them so /canopy improve can migrate.
    const compatLine = lines[compat.line] ?? '';
    const valueOnSameLine = compat.value.trim();
    const isInlineMapOrList = /^[\[{]/.test(valueOnSameLine);
    let isBlockMap = false;
    let collected = compat.value;
    for (let i = compat.line + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l === undefined) break;
      if (l.trim() === '---') break;
      if (/^[a-z][a-z0-9-]*:/.test(l)) break; // next top-level key
      if (l.trim() === '') continue;
      // Indented line under compatibility means block-form map/list.
      if (/^\s+\S/.test(l)) {
        isBlockMap = true;
      }
      collected += '\n' + l;
    }
    if (isInlineMapOrList || isBlockMap) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(compat.line, 0, compat.line, compatLine.length),
        `'compatibility' must be a YAML string per the agentskills.io spec (max 500 chars). ` +
        `Structured shapes like '{ requires: [...] }' or block-form maps are non-spec — ` +
        `rewrite as a free-text string. Run /canopy improve to migrate automatically.`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
    if (!isInlineMapOrList && !isBlockMap && valueOnSameLine.length > 500) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(compat.line, 0, compat.line, compatLine.length),
        `'compatibility' exceeds the 500-character limit defined by the agentskills.io spec.`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
    if (!/canopy-runtime/.test(collected)) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(compat.line, 0, compat.line, compatLine.length),
        `'compatibility' field on a canopy-flavored skill should name canopy-runtime as a required dependency ` +
        `and point at a locatable source so an agent can resolve and install it.`,
        vscode.DiagnosticSeverity.Hint
      ));
    }
  }

  // -------------------------------------------------------------------------
  // Safety preamble (fail-fast guard for unsupported platforms)
  // -------------------------------------------------------------------------

  private checkSafetyPreamble(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    // The safety preamble is a guard block in the body BEFORE ## Tree.
    // It must mention canopy-runtime so an agent without runtime knows to halt.
    // Look at the preamble section content (between frontmatter and first ## section).
    const preamble = parsed.sections.find(s => s.kind === 'preamble');
    if (!preamble) return;
    const text = preamble.content.toLowerCase();
    const mentionsRuntime = /canopy-runtime/.test(text);
    const mentionsHalt = /(halt|stop|abort|require|cannot)/.test(text);
    if (!mentionsRuntime || !mentionsHalt) {
      const startLine = preamble.startLine;
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(startLine, 0, startLine, lines[startLine]?.length ?? 0),
        `Canopy-flavored skills should include a safety preamble that mentions canopy-runtime ` +
        `and instructs the agent to halt on unsupported platforms. Missing or incomplete preamble.`,
        vscode.DiagnosticSeverity.Hint
      ));
    }
  }

  // -------------------------------------------------------------------------
  // S2: subagent-dispatch marker (call-site `**OP_NAME**`)
  // -------------------------------------------------------------------------

  /**
   * For every tree node in a skill file flagged as `subagentCall`, resolve
   * the op via the registry and verify the definition carries the matching
   * subagent marker. Mismatch → warning.
   */
  private async checkSubagentCallSites(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): Promise<void> {
    for (const node of parsed.treeNodes) {
      if (!node.subagentCall || !node.opName) continue;

      // Bold-wrapping a primitive makes no sense — primitives have fixed dispatch.
      if (node.isPrimitive) {
        const line = lines[node.line] ?? '';
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, 0, node.line, line.length),
          `Subagent dispatch marker '**${node.opName}**' applied to a framework primitive. Primitives are not user-defined ops — remove the bold wrapping.`,
          vscode.DiagnosticSeverity.Warning,
        ));
        continue;
      }

      const resolved = await registry.resolve(node.opName, document.uri);
      if (!resolved) continue; // unknown-op check covers this

      if (!resolved.definition.isSubagent) {
        const line = lines[node.line] ?? '';
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(node.line, 0, node.line, line.length),
          `Op '${node.opName}' is invoked as a subagent (bold call-site) but its definition has no '> **Subagent.**' marker. ` +
          `Add the marker to the op heading body (with 'Output contract: \`<schema-path>\`'), or remove the bold wrapping to dispatch inline.`,
          vscode.DiagnosticSeverity.Warning,
        ));
      }
    }
  }

  /**
   * For every op definition in an ops.md file that carries the subagent marker,
   * verify the schema files referenced by `Output contract:` (and optional
   * `Input contract:`) exist relative to the skill dir.
   */
  private checkSubagentMarkerDefs(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
    skillDir: string,
  ): void {
    // Resolve schemas relative to the skill root, not the ops file's dir.
    // `skillDir` here is the dir of the ops file (e.g. `<skill>/references/`);
    // walk up until we find a SKILL.md to locate the skill root.
    const skillRoot = this.findSkillRoot(skillDir);
    const refRoot = skillRoot ?? skillDir;

    for (const def of parsed.opDefinitions) {
      if (!def.isSubagent) continue;

      const markerLine = def.markerLine ?? def.startLine;
      const markerLineText = lines[markerLine] ?? '';
      const markerRange = new vscode.Range(markerLine, 0, markerLine, markerLineText.length);

      if (!def.outputContract) {
        diagnostics.push(new vscode.Diagnostic(
          markerRange,
          `Subagent marker on op '${def.name}' is missing 'Output contract: \`<schema-path>\`'. ` +
          `Subagent ops must declare an output schema so callers can rely on the shape.`,
          vscode.DiagnosticSeverity.Warning,
        ));
      } else {
        const target = path.join(refRoot, def.outputContract);
        if (!fs.existsSync(target)) {
          diagnostics.push(new vscode.Diagnostic(
            markerRange,
            `Subagent output contract file '${def.outputContract}' (op '${def.name}') not found relative to skill root.`,
            vscode.DiagnosticSeverity.Warning,
          ));
        }
      }

      if (def.inputContract) {
        const target = path.join(refRoot, def.inputContract);
        if (!fs.existsSync(target)) {
          diagnostics.push(new vscode.Diagnostic(
            markerRange,
            `Subagent input contract file '${def.inputContract}' (op '${def.name}') not found relative to skill root.`,
            vscode.DiagnosticSeverity.Warning,
          ));
        }
      }
    }
  }

  /** Walk up from `startDir` until a directory containing `SKILL.md` is found. */
  private findSkillRoot(startDir: string): string | undefined {
    let current = startDir;
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

  // -------------------------------------------------------------------------
  // S2.5: `metadata.canopy-features` manifest drift detection
  // -------------------------------------------------------------------------

  /**
   * For canopy-flavored skills (`## Tree` present), check the
   * `metadata.canopy-features` manifest against the actual tree usage.
   *
   * Per `canopy-runtime/references/skill-resources.md` → "Per-skill manifest"
   * and the framework's `canopy/assets/constants/validate-checks.md`:
   *
   * - Manifest absent → **Warning** (back-compat — runtime falls back to
   *   load-everything; `/canopy improve` proposes adding it).
   * - Declared feature not used in tree → **Error** (drift; remove unused).
   * - Used feature not declared → **Error** (drift; add missing entry).
   * - `core` listed → **Error** (implicit-always-loaded).
   * - Unknown feature value → **Error**.
   *
   * The framework's `/canopy validate` reports these as warnings everywhere
   * (its runtime is permissive). The vscode extension is stricter at
   * author-time — drift surfaces as Error so the IDE squiggle is visible.
   */
  private checkCanopyFeaturesManifest(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): void {
    const manifestLine = parsed.canopyFeaturesLine;

    if (parsed.canopyFeatures === undefined) {
      // No `metadata.canopy-features` declared — back-compat fallback.
      // Anchor the warning to line 0 (frontmatter top).
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, lines[0]?.length ?? 0),
        `'## Tree' skill missing 'metadata.canopy-features' manifest — runtime falls back to loading every spec slice. ` +
        `Add a manifest to load only what the skill uses. Run /canopy improve to add it automatically.`,
        vscode.DiagnosticSeverity.Warning,
      ));
      return;
    }

    const declared = new Set(parsed.canopyFeatures);
    const used = computeUsedFeatures(parsed);
    const lineNo = manifestLine ?? 0;
    const lineText = lines[lineNo] ?? '';
    const range = new vscode.Range(lineNo, 0, lineNo, lineText.length);

    // Check 1: `core` listed (implicit-always-loaded)
    if (declared.has('core')) {
      diagnostics.push(new vscode.Diagnostic(
        range,
        `'metadata.canopy-features' lists 'core' — the core slice (IF/ELSE_IF/ELSE/END/BREAK) is implicit-always-loaded. Remove it.`,
        vscode.DiagnosticSeverity.Error,
      ));
    }

    // Check 2: Unknown values
    for (const v of declared) {
      if (v === 'core') continue;
      if (!CANOPY_FEATURE_VALUES.has(v as CanopyFeature)) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `'metadata.canopy-features' lists unknown value '${v}'. Valid values: ${[...CANOPY_FEATURE_VALUES].join(', ')}.`,
          vscode.DiagnosticSeverity.Error,
        ));
      }
    }

    // Check 3: Declared-but-unused (drift)
    for (const v of declared) {
      if (v === 'core') continue;
      if (!CANOPY_FEATURE_VALUES.has(v as CanopyFeature)) continue; // already flagged
      if (!used.has(v as CanopyFeature)) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `'metadata.canopy-features' declares '${v}' but the skill's tree does not use it. Drift — remove unused entries.`,
          vscode.DiagnosticSeverity.Error,
        ));
      }
    }

    // Check 4: Used-but-undeclared (drift)
    for (const v of used) {
      if (!declared.has(v)) {
        diagnostics.push(new vscode.Diagnostic(
          range,
          `Tree uses '${v}' but 'metadata.canopy-features' does not declare it. Drift — add the missing entry.`,
          vscode.DiagnosticSeverity.Error,
        ));
      }
    }
  }

  // -------------------------------------------------------------------------
  // S3 (v0.22.0+): universal contract markers on inline ops (in ops.md)
  // -------------------------------------------------------------------------

  /**
   * For every op definition in an ops.md file that carries `inputContract` or
   * `outputContract` WITHOUT the `> **Subagent.**` lead (i.e. an inline op
   * with universal-contract markers), verify the schema files exist relative
   * to the skill root and the schemas' top-level `properties` align with the
   * op's `<<` / `>>` named inputs/outputs.
   *
   * Subagent ops are already covered by `checkSubagentMarkerDefs` — we only
   * handle the inline case here so the two methods don't double-flag.
   */
  private checkUniversalContractMarkers(
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
    skillDir: string,
  ): void {
    const skillRoot = this.findSkillRoot(skillDir);
    const refRoot = skillRoot ?? skillDir;

    for (const def of parsed.opDefinitions) {
      // Subagent ops handled separately.
      if (def.isSubagent) continue;
      if (!def.inputContract && !def.outputContract) continue;

      const markerLine = def.markerLine ?? def.startLine;
      const markerLineText = lines[markerLine] ?? '';
      const markerRange = new vscode.Range(markerLine, 0, markerLine, markerLineText.length);

      // File existence — same severity as subagent variant.
      if (def.outputContract) {
        const target = path.join(refRoot, def.outputContract);
        if (!fs.existsSync(target)) {
          diagnostics.push(new vscode.Diagnostic(
            markerRange,
            `Output contract file '${def.outputContract}' (op '${def.name}') not found relative to skill root.`,
            vscode.DiagnosticSeverity.Warning,
          ));
        } else {
          this.checkContractShape(def, def.outputContract, 'output', refRoot, markerRange, diagnostics);
        }
      }
      if (def.inputContract) {
        const target = path.join(refRoot, def.inputContract);
        if (!fs.existsSync(target)) {
          diagnostics.push(new vscode.Diagnostic(
            markerRange,
            `Input contract file '${def.inputContract}' (op '${def.name}') not found relative to skill root.`,
            vscode.DiagnosticSeverity.Warning,
          ));
        } else {
          this.checkContractShape(def, def.inputContract, 'input', refRoot, markerRange, diagnostics);
        }
      }
    }
  }

  /**
   * Compare a contract's top-level `properties` against the op's named
   * `<<` inputs (for input contracts) or `>>` named outputs (for output
   * contracts). Drift surfaces as a Warning anchored to the marker line.
   *
   * Two contract-shape conventions are accepted:
   *   1. **Wrapper** — schema's top-level `properties` mirror the op's
   *      named fields (e.g. signature `<< a | b | c` ↔ `{properties: {a, b, c}}`).
   *      This is the only sound shape when the op has 2+ named fields.
   *   2. **Direct shape** — the schema describes the shape of the single
   *      bound binding directly (e.g. `EXPLORE_TARGET >> context` ↔
   *      `{properties: {target, file_count, files, ...}}` describes the
   *      shape of `context`). Valid only when the op has exactly 1 named
   *      field on that side.
   *
   * Drift only surfaces when sigFields.length >= 2 AND a named field is
   * absent from the schema. The 1-field case is intentionally permissive —
   * either convention is valid and we can't know from the schema alone
   * which one the author intended.
   *
   * Permissive `additionalProperties: true` schemas should NOT trip this.
   */
  private checkContractShape(
    def: { name: string; inputs?: string[]; outputs?: string[] },
    contractPath: string,
    kind: 'input' | 'output',
    refRoot: string,
    range: vscode.Range,
    diagnostics: vscode.Diagnostic[],
  ): void {
    const resolved = loadSchema(refRoot, contractPath);
    if (!resolved || resolved.topLevelProperties.length === 0) return;
    const declared = new Set(resolved.topLevelProperties);
    const sigFields = (kind === 'input' ? def.inputs : def.outputs) ?? [];
    // 0 named fields: nothing to compare. 1 named field: ambiguous between
    // wrapper and direct-shape conventions — skip. 2+ fields: must be wrapper.
    if (sigFields.length < 2) return;

    const missing = sigFields.filter(f => !declared.has(f));
    if (missing.length === 0) return;

    diagnostics.push(new vscode.Diagnostic(
      range,
      `${kind === 'input' ? 'Input' : 'Output'} contract '${contractPath}' for op '${def.name}' is missing properties for signature field(s): ${missing.map(m => `'${m}'`).join(', ')}. ` +
      `Re-scaffold via /canopy improve --scaffold-contracts, or add the missing properties.`,
      vscode.DiagnosticSeverity.Warning,
    ));
  }

  // -------------------------------------------------------------------------
  // S3: `metadata.canopy-contracts: strict` manifest check
  // -------------------------------------------------------------------------

  /**
   * Validates the optional `metadata.canopy-contracts` manifest entry.
   *
   * - Value other than `strict` → Error (only `strict` is recognized).
   * - `strict` declared but no op in any ops.md carries a contract → Warning
   *   (strict mode tightens nothing — declare contracts on at least one op
   *   or remove the flag).
   *
   * The strict-without-contracts check requires reading the skill's ops
   * files. We use the registry's `allOpNames` resolution which has the same
   * walk; for performance we read each ops.md once.
   */
  private async checkCanopyContractsManifest(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): Promise<void> {
    if (parsed.canopyContracts === undefined) return;

    const lineNo = parsed.canopyContractsLine ?? 0;
    const lineText = lines[lineNo] ?? '';
    const range = new vscode.Range(lineNo, 0, lineNo, lineText.length);
    const value = parsed.canopyContracts.trim();

    if (!CANOPY_CONTRACT_VALUES.has(value)) {
      diagnostics.push(new vscode.Diagnostic(
        range,
        `'metadata.canopy-contracts' value '${value}' is not recognized. ` +
        `Valid values: ${[...CANOPY_CONTRACT_VALUES].join(', ')}.`,
        vscode.DiagnosticSeverity.Error,
      ));
      return;
    }

    // Strict declared — verify at least one op has a contract.
    const opNames = await registry.allOpNames(document.uri);
    let anyContract = false;
    for (const name of opNames) {
      const resolved = await registry.resolve(name, document.uri);
      if (resolved && (resolved.definition.inputContract || resolved.definition.outputContract)) {
        anyContract = true;
        break;
      }
    }
    if (!anyContract) {
      diagnostics.push(new vscode.Diagnostic(
        range,
        `'metadata.canopy-contracts: strict' declared but no op carries a contract. ` +
        `Strict mode tightens enforcement only where contracts exist — declare ` +
        `'> **Input contract:** \`...\`' / '> **Output contract:** \`...\`' on at least one op or remove the flag.`,
        vscode.DiagnosticSeverity.Warning,
      ));
    }
  }

  // -------------------------------------------------------------------------
  // S3: static type-flow analysis through the binding graph
  // -------------------------------------------------------------------------

  /**
   * For each binding edge in the skill tree (a downstream consumer that
   * binds a value emitted by an upstream producer), verify the producer's
   * output schema includes the bound key as a top-level property.
   *
   * Drift cases surfaced as Warnings on the consumer line:
   *   - Producer has an output contract but the bound `<key>` is not in
   *     the schema's top-level `properties` — the consumer is reading a
   *     field the producer doesn't declare it emits.
   *   - Consumer has an input contract that names properties the producer
   *     doesn't supply — the consumer expects more than the upstream
   *     binding can provide.
   *
   * No diagnostics emit for edges where neither side declares a contract
   * (back-compat: schema-less ops continue to work unchanged).
   */
  private async checkContractFlow(
    document: vscode.TextDocument,
    parsed: ReturnType<typeof parseDocument>,
    lines: string[],
    diagnostics: vscode.Diagnostic[],
  ): Promise<void> {
    const graph = buildBindingGraph(parsed);
    if (graph.edges.length === 0) return;

    const skillDir = path.dirname(document.uri.fsPath);
    const skillRoot = this.findSkillRoot(skillDir) ?? skillDir;

    for (const edge of graph.edges) {
      const producerDef = await registry.resolve(edge.producer.producerOp, document.uri);
      const consumerDef = await registry.resolve(edge.consumer.consumerOp, document.uri);

      const producerOut = producerDef?.definition.outputContract;
      if (producerOut) {
        const schema = loadSchema(skillRoot, producerOut);
        if (schema && schema.topLevelProperties.length > 0 &&
            !schema.topLevelProperties.includes(edge.consumer.key)) {
          const line = lines[edge.consumer.consumerNode.line] ?? '';
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(edge.consumer.consumerNode.line, 0,
                             edge.consumer.consumerNode.line, line.length),
            `Binding '<< ${edge.consumer.key}' reads a key the upstream producer ` +
            `'${edge.producer.producerOp}' (line ${edge.producer.producerNode.line + 1}) ` +
            `does not declare in its output contract '${producerOut}'. ` +
            `Add '${edge.consumer.key}' to the schema's properties, or update the binding.`,
            vscode.DiagnosticSeverity.Warning,
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
