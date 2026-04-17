import { describe, it, expect, vi, afterEach } from 'vitest';
import { PRIMITIVE_DOCS, OpRegistry } from '../opRegistry';
import * as vscode from 'vscode';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(fs.existsSync).mockReset();
});

// ---------------------------------------------------------------------------
// PRIMITIVE_DOCS
// ---------------------------------------------------------------------------

describe('PRIMITIVE_DOCS', () => {
  const ALL_PRIMITIVES = ['IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'];

  it('contains all 9 framework primitives', () => {
    for (const name of ALL_PRIMITIVES) {
      expect(PRIMITIVE_DOCS).toHaveProperty(name);
    }
  });

  it.each(ALL_PRIMITIVES)('%s has name, signature, description, and example', (name) => {
    const doc = PRIMITIVE_DOCS[name];
    expect(doc.name).toBe(name);
    expect(doc.signature).toBeTruthy();
    expect(doc.description).toBeTruthy();
    expect(doc.example).toBeTruthy();
  });

  it('IF signature uses << for input', () => {
    expect(PRIMITIVE_DOCS.IF.signature).toContain('<<');
    expect(PRIMITIVE_DOCS.IF.signature).not.toContain('>>');
  });

  it('SHOW_PLAN signature uses >> for output', () => {
    expect(PRIMITIVE_DOCS.SHOW_PLAN.signature).toContain('>>');
  });

  it('EXPLORE signature uses >> for output', () => {
    expect(PRIMITIVE_DOCS.EXPLORE.signature).toContain('>>');
    expect(PRIMITIVE_DOCS.EXPLORE.signature).not.toContain('<<');
  });

  it('ELSE signature has no << or >> operators', () => {
    expect(PRIMITIVE_DOCS.ELSE.signature).not.toContain('<<');
    expect(PRIMITIVE_DOCS.ELSE.signature).not.toContain('>>');
  });

  it('BREAK signature has no << or >> operators', () => {
    expect(PRIMITIVE_DOCS.BREAK.signature).not.toContain('<<');
    expect(PRIMITIVE_DOCS.BREAK.signature).not.toContain('>>');
  });
});

// ---------------------------------------------------------------------------
// OpRegistry.loadDefs
// ---------------------------------------------------------------------------

describe('OpRegistry.loadDefs', () => {
  it('parses op definitions from file content', async () => {
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP << input\nDo something.\n## OTHER_OP\nDo other things.') as any
    );
    const reg = new OpRegistry();
    const uri = vscode.Uri.file('/test/ops.md') as any;
    const defs = await reg.loadDefs(uri);
    expect(defs).toHaveLength(2);
    expect(defs[0].name).toBe('MY_OP');
    expect(defs[1].name).toBe('OTHER_OP');
  });

  it('returns empty array when file read throws', async () => {
    vi.spyOn(vscode.workspace.fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
    const reg = new OpRegistry();
    const defs = await reg.loadDefs(vscode.Uri.file('/test/missing.md') as any);
    expect(defs).toHaveLength(0);
  });

  it('returns empty array for empty file', async () => {
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(new Uint8Array() as any);
    const reg = new OpRegistry();
    const defs = await reg.loadDefs(vscode.Uri.file('/test/empty.md') as any);
    expect(defs).toHaveLength(0);
  });

  it('caches results so readFile is called only once per URI', async () => {
    const spy = vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const uri = vscode.Uri.file('/test/ops.md') as any;
    await reg.loadDefs(uri);
    await reg.loadDefs(uri);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns the same reference from cache on repeated calls', async () => {
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## CACHED_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const uri = vscode.Uri.file('/test/ops.md') as any;
    const first = await reg.loadDefs(uri);
    const second = await reg.loadDefs(uri);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// OpRegistry.invalidate
// ---------------------------------------------------------------------------

describe('OpRegistry.invalidate', () => {
  it('clears the cache so the next loadDefs re-reads the file', async () => {
    const spy = vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const uri = vscode.Uri.file('/test/ops.md') as any;
    await reg.loadDefs(uri);
    reg.invalidate(uri);
    await reg.loadDefs(uri);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('invalidating an un-cached URI does not throw', () => {
    const reg = new OpRegistry();
    expect(() => reg.invalidate(vscode.Uri.file('/test/nonexistent.md') as any)).not.toThrow();
  });

  it('does not affect other cached URIs', async () => {
    const spy = vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const uriA = vscode.Uri.file('/test/a/ops.md') as any;
    const uriB = vscode.Uri.file('/test/b/ops.md') as any;
    await reg.loadDefs(uriA);
    await reg.loadDefs(uriB);
    reg.invalidate(uriA);
    await reg.loadDefs(uriB); // B still cached — no extra read
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// OpRegistry.resolve
// ---------------------------------------------------------------------------

describe('OpRegistry.resolve', () => {
  it('returns undefined when no ops files exist anywhere', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const reg = new OpRegistry();
    const result = await reg.resolve('MY_OP', vscode.Uri.file('/test/skill/skill.md') as any);
    expect(result).toBeUndefined();
  });

  it('returns skill-local definition when sibling ops.md exists', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('ops.md'));
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP << input\nDo something.') as any
    );
    const reg = new OpRegistry();
    const result = await reg.resolve('MY_OP', vscode.Uri.file('/test/skill/skill.md') as any);
    expect(result).toBeDefined();
    expect(result!.source).toBe('skill-local');
    expect(result!.definition.name).toBe('MY_OP');
  });

  it('returns undefined when the op is not defined in any found ops.md', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('ops.md'));
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## OTHER_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const result = await reg.resolve('MY_OP', vscode.Uri.file('/test/skill/skill.md') as any);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OpRegistry.allOpNames
// ---------------------------------------------------------------------------

describe('OpRegistry.allOpNames', () => {
  it('returns empty array when no ops files exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const reg = new OpRegistry();
    const names = await reg.allOpNames(vscode.Uri.file('/test/skill/skill.md') as any);
    expect(names).toEqual([]);
  });

  it('returns op names from sibling ops.md', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('ops.md'));
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## FIRST_OP\nbody\n## SECOND_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const names = await reg.allOpNames(vscode.Uri.file('/test/skill/skill.md') as any);
    expect(names).toContain('FIRST_OP');
    expect(names).toContain('SECOND_OP');
  });

  it('returns no duplicate names', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('ops.md'));
    vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      Buffer.from('## MY_OP\nbody') as any
    );
    const reg = new OpRegistry();
    const names = await reg.allOpNames(vscode.Uri.file('/test/skill/skill.md') as any);
    expect(new Set(names).size).toBe(names.length);
  });
});
