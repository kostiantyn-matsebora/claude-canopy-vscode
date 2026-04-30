/**
 * Op Registry — resolves op definitions following the Canopy lookup chain:
 *   1. <skill>/references/ops.md             (skill-local, standard layout)
 *   2. <skill>/references/ops/<name>.md      (skill-local, per-op files)
 *   3. <skill>/ops.md                        (skill-local, legacy flat layout)
 *   4. shared/project/ops.md                 (project-wide)
 *   5. shared/framework/ops.md               (framework primitives)
 *
 * Also exposes static documentation for the built-in framework primitives.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseOpDefinitions, OpDefinition } from './canopyDocument';

// ---------------------------------------------------------------------------
// Framework primitive documentation (static, never overridden)
// ---------------------------------------------------------------------------
export interface PrimitiveDoc {
  name: string;
  signature: string;
  description: string;
  example: string;
}

export const PRIMITIVE_DOCS: Record<string, PrimitiveDoc> = {
  IF: {
    name: 'IF',
    signature: 'IF << condition',
    description: 'Branch on a boolean condition. Children execute if the condition is true.',
    example: 'IF << $ARGUMENTS is not valid semver\n  └── END Invalid version',
  },
  ELSE_IF: {
    name: 'ELSE_IF',
    signature: 'ELSE_IF << condition',
    description: 'Continue an IF chain. Evaluated only if all prior IF/ELSE_IF conditions were false.',
    example: 'ELSE_IF << file is a pyproject.toml\n  └── UPDATE_PYPROJECT',
  },
  ELSE: {
    name: 'ELSE',
    signature: 'ELSE',
    description: 'Final branch of an IF chain. Executes if all prior conditions were false.',
    example: 'ELSE\n  └── natural language fallback action',
  },
  BREAK: {
    name: 'BREAK',
    signature: 'BREAK',
    description: 'Exit the current op and resume the caller\'s next tree node (non-fatal).',
    example: 'IF << no commits found\n  └── BREAK',
  },
  END: {
    name: 'END',
    signature: 'END [message]',
    description: 'Halt the entire skill immediately. Displays an optional message to the user.',
    example: 'END Version argument is not valid semver — expected MAJOR.MINOR.PATCH',
  },
  ASK: {
    name: 'ASK',
    signature: 'ASK << question | option1 | option2 [...]',
    description: 'Prompt the user with a question and a set of options. Skill halts until the user responds.',
    example: 'ASK << Proceed? | Yes | No',
  },
  SHOW_PLAN: {
    name: 'SHOW_PLAN',
    signature: 'SHOW_PLAN >> field1 | field2 | ...',
    description: 'Display a structured plan summary before executing changes. Fields become labeled rows in the output.',
    example: 'SHOW_PLAN >> current version | new version | files to update | changelog action',
  },
  VERIFY_EXPECTED: {
    name: 'VERIFY_EXPECTED',
    signature: 'VERIFY_EXPECTED << verify/<file>.md',
    description: 'Check the current working state against the expected-state checklist in the referenced verify/ file.',
    example: 'VERIFY_EXPECTED << verify/verify-expected.md',
  },
  EXPLORE: {
    name: 'EXPLORE',
    signature: 'EXPLORE >> context',
    description: 'Run the explore subagent declared in ## Agent. Must be the first tree node when ## Agent is present. Output is bound to the context variable.',
    example: 'EXPLORE >> context',
  },
  FOR_EACH: {
    name: 'FOR_EACH',
    signature: 'FOR_EACH << item in collection',
    description: 'Iterate over a collection. The body executes once per element. An empty collection skips the body entirely. BREAK inside exits the loop early.',
    example: 'FOR_EACH << change in context.changes_detected\n  └── APPLY_CHANGE << change',
  },
  SWITCH: {
    name: 'SWITCH',
    signature: 'SWITCH << expression',
    description: 'Evaluate an expression once and execute the first matching CASE block. Use DEFAULT as the fallback when no CASE matches. Replaces long IF/ELSE_IF chains that branch on a single value.',
    example: 'SWITCH << bump_type\n  CASE << major\n    └── ...\n  DEFAULT\n    └── ...',
  },
  CASE: {
    name: 'CASE',
    signature: 'CASE << value',
    description: 'A branch inside a SWITCH block. Executes when the SWITCH expression matches this value.',
    example: 'CASE << minor\n  └── Increment minor segment',
  },
  DEFAULT: {
    name: 'DEFAULT',
    signature: 'DEFAULT',
    description: 'Fallback branch inside a SWITCH block. Executes when no CASE matched.',
    example: 'DEFAULT\n  └── Set bump_type to "patch"',
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface ResolvedOp {
  definition: OpDefinition;
  source: 'skill-local' | 'project' | 'framework';
}

export class OpRegistry {
  private cache = new Map<string, OpDefinition[]>(); // uri.fsPath -> parsed defs

  /** Resolve an op name given the document that references it. Returns undefined if not found. */
  async resolve(opName: string, fromDocument: vscode.Uri): Promise<ResolvedOp | undefined> {
    // 1. skill-local ops (references/ops.md, references/ops/<name>.md, or legacy ops.md)
    for (const skillOpsUri of this.skillOpsUris(fromDocument)) {
      const defs = await this.loadDefs(skillOpsUri);
      const def = defs.find(d => d.name === opName);
      if (def) return { definition: def, source: 'skill-local' };
    }

    // 2. shared/project/ops.md
    const projectOpsUri = await this.findSharedOps(fromDocument, 'project');
    if (projectOpsUri) {
      const defs = await this.loadDefs(projectOpsUri);
      const def = defs.find(d => d.name === opName);
      if (def) return { definition: def, source: 'project' };
    }

    // 3. shared/framework/ops.md
    const frameworkOpsUri = await this.findSharedOps(fromDocument, 'framework');
    if (frameworkOpsUri) {
      const defs = await this.loadDefs(frameworkOpsUri);
      const def = defs.find(d => d.name === opName);
      if (def) return { definition: def, source: 'framework' };
    }

    return undefined;
  }

  /** Return all op names visible from a given document (for completion). */
  async allOpNames(fromDocument: vscode.Uri): Promise<string[]> {
    const seen = new Set<string>();
    const names: string[] = [];

    const collect = (defs: OpDefinition[]) => {
      for (const d of defs) {
        if (!seen.has(d.name)) {
          seen.add(d.name);
          names.push(d.name);
        }
      }
    };

    for (const skillOpsUri of this.skillOpsUris(fromDocument)) {
      collect(await this.loadDefs(skillOpsUri));
    }

    const projectOpsUri = await this.findSharedOps(fromDocument, 'project');
    if (projectOpsUri) collect(await this.loadDefs(projectOpsUri));

    const frameworkOpsUri = await this.findSharedOps(fromDocument, 'framework');
    if (frameworkOpsUri) collect(await this.loadDefs(frameworkOpsUri));

    return names;
  }

  /** Load and cache op definitions from an ops.md URI. */
  async loadDefs(uri: vscode.Uri): Promise<OpDefinition[]> {
    const key = uri.fsPath;
    if (this.cache.has(key)) return this.cache.get(key)!;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      const lines = text.split(/\r?\n/);
      const defs = parseOpDefinitions(lines, uri);
      this.cache.set(key, defs);
      return defs;
    } catch {
      return [];
    }
  }

  /** Invalidate cached defs when a file changes. */
  invalidate(uri: vscode.Uri): void {
    this.cache.delete(uri.fsPath);
  }

  // -------------------------------------------------------------------------
  // Path helpers
  // -------------------------------------------------------------------------

  /**
   * For a skill document, return all skill-local ops file URIs in lookup order:
   *   1. <skill>/references/ops.md          (standard layout, single file)
   *   2. <skill>/references/ops/*.md        (standard layout, per-op files)
   *   3. <skill>/ops.md                     (legacy flat layout)
   *
   * If the document itself lives under references/ops/ (per-op file) or is
   * references/ops.md, the skill root resolves to two levels up.
   */
  private skillOpsUris(docUri: vscode.Uri): vscode.Uri[] {
    const skillDir = this.findSkillRoot(docUri.fsPath);
    if (!skillDir) {
      // Fallback: same directory as the doc (covers the case when skill root cannot
      // be determined from a non-canonical layout).
      const dir = path.dirname(docUri.fsPath);
      return this.collectOpsInSkillDir(dir);
    }
    return this.collectOpsInSkillDir(skillDir);
  }

  private collectOpsInSkillDir(skillDir: string): vscode.Uri[] {
    const uris: vscode.Uri[] = [];

    // 1. references/ops.md
    const refsOps = path.join(skillDir, 'references', 'ops.md');
    if (fs.existsSync(refsOps)) {
      uris.push(vscode.Uri.file(refsOps));
    }

    // 2. references/ops/*.md
    const refsOpsDir = path.join(skillDir, 'references', 'ops');
    if (fs.existsSync(refsOpsDir) && fs.statSync(refsOpsDir).isDirectory()) {
      try {
        const entries = fs.readdirSync(refsOpsDir);
        for (const e of entries) {
          if (e.toLowerCase().endsWith('.md')) {
            uris.push(vscode.Uri.file(path.join(refsOpsDir, e)));
          }
        }
      } catch { /* ignore */ }
    }

    // 3. legacy ops.md at skill root
    const legacyOps = path.join(skillDir, 'ops.md');
    if (fs.existsSync(legacyOps)) {
      uris.push(vscode.Uri.file(legacyOps));
    }

    return uris;
  }

  /**
   * Resolve the skill root directory containing `SKILL.md` (or legacy `skill.md`).
   * Walks up from the given document path. Returns undefined if no SKILL.md is
   * found within a few levels (skill files normally live at depth ≤ 3 from root:
   * SKILL.md, references/ops.md, references/ops/<name>.md).
   */
  private findSkillRoot(startPath: string): string | undefined {
    let current = path.dirname(startPath);
    for (let i = 0; i < 4; i++) {
      const upper = path.join(current, 'SKILL.md');
      const lower = path.join(current, 'skill.md');
      if (fs.existsSync(upper) || fs.existsSync(lower)) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return undefined;
  }

  /**
   * Walk up from the document to find an agentskills root, then resolve:
   *   <root>/skills/shared/<kind>/ops.md
   * OR for canopy submodule:
   *   <root>/canopy/skills/shared/<kind>/ops.md
   */
  private async findSharedOps(docUri: vscode.Uri, kind: 'project' | 'framework'): Promise<vscode.Uri | undefined> {
    const skillsRoot = this.findSkillsRoot(docUri.fsPath);
    if (!skillsRoot) return undefined;

    const candidates = [
      path.join(skillsRoot, 'skills', 'shared', kind, 'ops.md'),
      path.join(skillsRoot, 'canopy', 'skills', 'shared', kind, 'ops.md'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return vscode.Uri.file(c);
    }
    return undefined;
  }

  /**
   * Walk up directory tree to find the parent agentskills root.
   * Recognized roots, first match wins:
   *   .agents/  — Cross-client (gh skill install default since gh 2.91)
   *   .claude/  — Claude Code
   *   .github/  — GitHub Copilot
   */
  private findSkillsRoot(startPath: string): string | undefined {
    const ROOT_DIRS = ['.agents', '.claude', '.github'];
    let current = path.dirname(startPath);
    const root = path.parse(current).root;
    while (current !== root) {
      for (const d of ROOT_DIRS) {
        const candidate = path.join(current, d);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          return candidate;
        }
      }
      current = path.dirname(current);
    }
    return undefined;
  }
}

// Singleton
export const registry = new OpRegistry();
