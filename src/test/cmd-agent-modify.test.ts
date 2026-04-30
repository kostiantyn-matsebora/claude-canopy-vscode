import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentModify } from '../commands/canopyAgent';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() };
});
vi.mock('../availability', () => ({ isCommandAvailable: vi.fn(async () => true) }));

const sendText = vi.fn();
const term = { show: vi.fn(), sendText, exitStatus: undefined } as unknown as vscode.Terminal;

// Minimal Dirent-like stand-in matching the shape canopyAgent.listProjectSkills consumes.
const fakeDirent = (name: string) => ({
  name,
  isDirectory: () => true,
  isFile: () => false,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(vscode.window, 'createTerminal').mockReturnValue(term);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
    configurable: true,
  });
  // Pretend the canopy-runtime marker, the skills root, and the fake `probe` skill's SKILL.md all exist.
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    return (
      s.includes('skills/canopy-runtime/SKILL.md') ||
      s.endsWith('.claude/skills') ||
      s.endsWith('skills/probe/SKILL.md')
    );
  });
  vi.mocked(fs.readdirSync).mockReturnValue([fakeDirent('probe')] as unknown as ReturnType<typeof fs.readdirSync>);
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.agentModify', () => {
  it('happy path: pickSkill + change description → /canopy modify dispatch', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'probe' } as never);
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('add SHOW_PLAN step');

    await agentModify();

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe(
      'claude "/canopy modify the probe skill — add SHOW_PLAN step"',
    );
  });

  it('cancel path: pickSkill returns undefined → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    const inputSpy = vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('unused');

    await agentModify();

    expect(inputSpy).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });
});
