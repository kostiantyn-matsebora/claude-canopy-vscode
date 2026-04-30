import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentImprove } from '../commands/canopyAgent';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() };
});
vi.mock('../availability', () => ({ isCommandAvailable: vi.fn(async () => true) }));

const sendText = vi.fn();
const term = { show: vi.fn(), sendText, exitStatus: undefined } as unknown as vscode.Terminal;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(vscode.window, 'createTerminal').mockReturnValue(term);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
    configurable: true,
  });
  // existsSync: true for the canopy-runtime marker (project detection)
  // and for the SKILL.md inside the probe-legacy skill dir + the skills root itself.
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    if (s.includes('skills/canopy-runtime/SKILL.md')) return true;
    if (s.endsWith('/.claude/skills')) return true;
    if (s.endsWith('/probe-legacy/SKILL.md')) return true;
    return false;
  });
  // readdirSync: return a single Dirent for probe-legacy under the skills root.
  vi.mocked(fs.readdirSync).mockImplementation(((_p: fs.PathLike, _opts?: unknown) => {
    return [
      {
        name: 'probe-legacy',
        isDirectory: () => true,
        isFile: () => false,
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
      } as unknown as fs.Dirent,
    ];
  }) as unknown as typeof fs.readdirSync);
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.agentImprove', () => {
  it('happy path: picks probe-legacy skill and dispatches /canopy improve', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(
      { label: 'probe-legacy' } as unknown as vscode.QuickPickItem,
    );
    await agentImprove();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toContain(
      '/canopy improve the probe-legacy skill — align with framework rules',
    );
  });

  it('cancel path: no skill picked → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    await agentImprove();
    expect(sendText).not.toHaveBeenCalled();
  });
});
