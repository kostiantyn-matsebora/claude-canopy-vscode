import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { newCommandsFile } from '../commands/newResource';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

const SKILL_FILE = '/proj/.claude/skills/my-skill/SKILL.md';
const SKILL_DIR = '/proj/.claude/skills/my-skill';

beforeEach(() => {
  vi.clearAllMocks();

  // Active editor points at a SKILL.md so getActiveSkillDir() resolves.
  Object.defineProperty(vscode.window, 'activeTextEditor', {
    value: {
      document: { uri: { fsPath: SKILL_FILE } },
    },
    configurable: true,
  });

  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
    configurable: true,
  });

  // existsSync: SKILL.md exists, target script file doesn't (so createAndOpen writes).
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    return s.endsWith('/SKILL.md');
  });

  // Stub openTextDocument / showTextDocument so createAndOpen completes without UI.
  (vscode.workspace as unknown as { openTextDocument: unknown }).openTextDocument = vi
    .fn()
    .mockResolvedValue({});
  (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument = vi
    .fn()
    .mockResolvedValue({});
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.newCommandsFile', () => {
  it('happy path: prompts for name and script type, writes scripts/<name>.sh', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('deploy');
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
      label: '.sh',
      description: 'Bash / Shell',
    } as unknown as vscode.QuickPickItem);

    await newCommandsFile();

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = String(vi.mocked(fs.writeFileSync).mock.calls[0][0]).replace(/\\/g, '/');
    expect(writtenPath).toMatch(/scripts\/deploy\.sh$/);
    expect(writtenPath.startsWith(SKILL_DIR)).toBe(true);
  });

  it('cancel path: name input dismissed → no writeFileSync', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
    const qp = vi.spyOn(vscode.window, 'showQuickPick');

    await newCommandsFile();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(qp).not.toHaveBeenCalled();
  });
});
