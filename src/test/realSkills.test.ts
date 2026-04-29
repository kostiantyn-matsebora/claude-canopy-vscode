import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseDocument } from '../canopyDocument';

/**
 * Integration test: pull real SKILL.md files from claude-canopy and from this
 * repo's installed skills, and verify the extension's parser (and the v0.18.0
 * frontmatter spec — agentskills.io alignment) handles them without surprise.
 */

const CANOPY_REPO = path.resolve(__dirname, '..', '..', '..', 'claude-canopy');
const SELF_REPO = path.resolve(__dirname, '..', '..');

// agentskills.io spec — these are the only fields valid at frontmatter root.
// `argument-hint` and `user-invocable` are non-spec; canopy v0.18.0 moves them
// inside `metadata`.
const FRONTMATTER_ALLOWED = new Set([
  'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools',
]);

function makeDoc(filePath: string): vscode.TextDocument {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    uri: { fsPath: filePath } as vscode.Uri,
    fileName: filePath,
    languageId: 'canopy',
    getText: () => text,
    lineCount: text.split(/\r?\n/).length,
    lineAt: (n: number) => ({ text: text.split(/\r?\n/)[n] ?? '' }),
  } as unknown as vscode.TextDocument;
}

describe('real SKILL.md files (v0.18.0)', () => {
  it('canopy/SKILL.md: frontmatter keys are all in FRONTMATTER_ALLOWED', () => {
    const file = path.join(CANOPY_REPO, 'skills', 'canopy', 'SKILL.md');
    if (!fs.existsSync(file)) return;
    const parsed = parseDocument(makeDoc(file));
    const unknown = parsed.frontmatter.filter(f => !FRONTMATTER_ALLOWED.has(f.key));
    expect(unknown.map(f => f.key)).toEqual([]);
    expect(parsed.frontmatter.map(f => f.key))
      .toEqual(expect.arrayContaining(['name', 'description', 'license', 'allowed-tools', 'metadata']));
    expect(parsed.hasTreeSection).toBe(true);
    expect(parsed.hasAgentSection).toBe(true);
    expect(parsed.treeFirstOpName).toBe('EXPLORE');
  });

  it('canopy-runtime/SKILL.md: parses cleanly with allowed frontmatter (user-invocable now lives in metadata)', () => {
    const file = path.join(CANOPY_REPO, 'skills', 'canopy-runtime', 'SKILL.md');
    if (!fs.existsSync(file)) return;
    const parsed = parseDocument(makeDoc(file));
    const unknown = parsed.frontmatter.filter(f => !FRONTMATTER_ALLOWED.has(f.key));
    expect(unknown.map(f => f.key)).toEqual([]);
    expect(parsed.frontmatter.map(f => f.key))
      .toEqual(expect.arrayContaining(['name', 'description', 'metadata']));
    // canopy-runtime is overview text, not a tree-driven skill — no ## Tree expected.
  });

  it('canopy-debug/SKILL.md: parses cleanly with allowed frontmatter', () => {
    const file = path.join(CANOPY_REPO, 'skills', 'canopy-debug', 'SKILL.md');
    if (!fs.existsSync(file)) return;
    const parsed = parseDocument(makeDoc(file));
    const unknown = parsed.frontmatter.filter(f => !FRONTMATTER_ALLOWED.has(f.key));
    expect(unknown.map(f => f.key)).toEqual([]);
  });

  it('vscode-repo bundled skills (.claude/skills/*/SKILL.md): all parse with allowed frontmatter', () => {
    const skillsRoot = path.join(SELF_REPO, '.claude', 'skills');
    if (!fs.existsSync(skillsRoot)) return;
    const skills = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    for (const skill of skills) {
      const file = path.join(skillsRoot, skill, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const parsed = parseDocument(makeDoc(file));
      const unknown = parsed.frontmatter.filter(f => !FRONTMATTER_ALLOWED.has(f.key));
      expect(unknown.map(f => f.key), `unknown frontmatter in skills/${skill}/SKILL.md`).toEqual([]);
      expect(parsed.frontmatter.map(f => f.key), `missing required name/description in skills/${skill}/SKILL.md`)
        .toEqual(expect.arrayContaining(['name', 'description']));
    }
  });
});
