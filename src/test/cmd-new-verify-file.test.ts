import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { newVerifyFile } from '../commands/newResource';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const SKILL_DIR = path.join(path.sep, 'proj', '.claude', 'skills', 'my-skill');
const SKILL_FILE = path.join(SKILL_DIR, 'SKILL.md');

beforeEach(() => {
  vi.clearAllMocks();

  // Active editor pointing at the skill's SKILL.md so getActiveSkillDir() returns SKILL_DIR.
  Object.defineProperty(vscode.window, 'activeTextEditor', {
    value: { document: { uri: { fsPath: SKILL_FILE } } },
    configurable: true,
  });

  // Single workspace folder (not strictly needed since active editor resolves dir, but harmless).
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: path.join(path.sep, 'proj') }, name: 'proj', index: 0 }],
    configurable: true,
  });

  // Stub openTextDocument / showTextDocument so createAndOpen completes without touching real FS.
  // The mock vscode module doesn't define these; assign directly.
  (vscode.workspace as unknown as { openTextDocument: unknown }).openTextDocument =
    vi.fn(async () => ({}));
  (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument =
    vi.fn(async () => ({}));

  // Default existsSync: SKILL.md exists, target verify file does not.
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    if (s.endsWith('/SKILL.md')) return true;
    return false;
  });
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.newVerifyFile', () => {
  it('happy path: writes assets/verify/<name>.md with checklist content', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('checkout-flow');

    await newVerifyFile();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fs.writeFileSync).mock.calls[0];
    const writtenPath = String(call[0]).replace(/\\/g, '/');
    const writtenContent = String(call[1]);

    expect(writtenPath.endsWith('assets/verify/checkout-flow.md')).toBe(true);
    // Content is checklist-flavored: contains `- [ ]` checkboxes and the
    // expected section headers from VERIFY_TEMPLATE.
    expect(writtenContent).toContain('- [ ]');
    expect(writtenContent).toContain('## Changes applied');
    expect(writtenContent).toContain('## No regressions');
    // Skill name (basename of the active skill dir) is interpolated into the heading.
    expect(writtenContent).toContain('my-skill');
  });

  it('cancel path: showInputBox returns undefined → no writeFileSync', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);

    await newVerifyFile();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
