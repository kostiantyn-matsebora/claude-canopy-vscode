import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { newSchema } from '../commands/newResource';

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

  // Active editor at SKILL.md so getActiveSkillDir() resolves directly.
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

  // existsSync: SKILL.md exists, target schema file does not (so createAndOpen writes).
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

describe('canopy.newSchema', () => {
  it('happy path: type-first then name → writes assets/schemas/<name>.json', async () => {
    // Type prompt: pick "custom" so the handler asks for a name next.
    const qp = vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({
      label: 'custom',
      description: 'Custom schema file',
    } as unknown as vscode.QuickPickItem);

    // Name prompt: user types "user-input".
    const ib = vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('user-input');

    await newSchema();

    expect(qp).toHaveBeenCalledTimes(1);
    expect(ib).toHaveBeenCalledTimes(1);
    // Order check: showQuickPick must have been invoked before showInputBox.
    expect(qp.mock.invocationCallOrder[0]).toBeLessThan(ib.mock.invocationCallOrder[0]);

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = String(vi.mocked(fs.writeFileSync).mock.calls[0][0]).replace(/\\/g, '/');
    expect(writtenPath).toMatch(/assets\/schemas\/user-input\.json$/);
    expect(writtenPath.startsWith(SKILL_DIR)).toBe(true);
  });

  it('cancel path: type quick-pick dismissed → no name prompt, no writeFileSync', async () => {
    const qp = vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    const ib = vi.spyOn(vscode.window, 'showInputBox');

    await newSchema();

    expect(qp).toHaveBeenCalledTimes(1);
    expect(ib).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
