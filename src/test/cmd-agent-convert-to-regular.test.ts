import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentConvertToRegular } from '../commands/canopyAgent';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  };
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
  // Mark canopy-runtime SKILL.md present (project marker), and probe-canopy SKILL.md present
  // so listProjectSkills accepts it.
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    if (s.includes('skills/canopy-runtime/SKILL.md')) return true;
    if (s.endsWith('/skills')) return true;
    if (s.includes('skills/probe-canopy/SKILL.md')) return true;
    return false;
  });
  // Stub readdirSync (with withFileTypes:true) to return one fake skill dir
  vi.mocked(fs.readdirSync).mockImplementation(((..._args: unknown[]) => {
    return [
      { name: 'probe-canopy', isDirectory: () => true } as unknown as fs.Dirent,
    ];
  }) as typeof fs.readdirSync);
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.agentConvertToRegular', () => {
  it('happy path: picks skill and dispatches /canopy convert ... back to a regular plain skill', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ label: 'probe-canopy' } as vscode.QuickPickItem);
    await agentConvertToRegular();
    expect(sendText).toHaveBeenCalledTimes(1);
    const sent = sendText.mock.calls[0][0] as string;
    expect(sent).toContain('/canopy convert the probe-canopy skill back to a regular plain skill');
    expect(sent).toBe('claude "/canopy convert the probe-canopy skill back to a regular plain skill"');
  });

  it('cancel path: showQuickPick returns undefined → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    await agentConvertToRegular();
    expect(sendText).not.toHaveBeenCalled();
  });
});
