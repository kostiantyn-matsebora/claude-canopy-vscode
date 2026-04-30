import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { newPolicyFile } from '../commands/newResource';

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

  // Active editor points at SKILL.md so getActiveSkillDir() returns SKILL_DIR.
  Object.defineProperty(vscode.window, 'activeTextEditor', {
    value: { document: { uri: { fsPath: SKILL_FILE } } },
    configurable: true,
  });

  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: path.join(path.sep, 'proj') }, name: 'proj', index: 0 }],
    configurable: true,
  });

  // Stub openTextDocument / showTextDocument so createAndOpen completes without UI.
  (vscode.workspace as unknown as { openTextDocument: unknown }).openTextDocument =
    vi.fn(async () => ({}));
  (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument =
    vi.fn(async () => ({}));

  // existsSync: SKILL.md exists, target policy file does not (so createAndOpen writes).
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    return s.endsWith('/SKILL.md');
  });
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.newPolicyFile', () => {
  it('happy path: writes assets/policies/<name>.md with policy template content', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('redaction');

    await newPolicyFile();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fs.writeFileSync).mock.calls[0];
    const writtenPath = String(call[0]).replace(/\\/g, '/');
    const writtenContent = String(call[1]);

    expect(writtenPath.endsWith('assets/policies/redaction.md')).toBe(true);
    expect(writtenPath.startsWith(SKILL_DIR.replace(/\\/g, '/'))).toBe(true);
    // Content from POLICY_TEMPLATE: heading + Rules + Constraints sections.
    expect(writtenContent).toContain('# redaction');
    expect(writtenContent).toContain('## Rules');
    expect(writtenContent).toContain('## Constraints');
  });

  it('cancel path: showInputBox returns undefined → no writeFileSync', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);

    await newPolicyFile();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
