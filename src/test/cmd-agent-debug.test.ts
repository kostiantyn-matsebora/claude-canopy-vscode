import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentDebug } from '../commands/canopyAgent';

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
  // Marker present + probe skill's SKILL.md present so listProjectSkills picks it up.
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const s = String(p).replace(/\\/g, '/');
    return (
      s.includes('skills/canopy-runtime/SKILL.md') ||
      s.endsWith('skills') ||
      s.endsWith('skills/probe/SKILL.md')
    );
  });
  vi.mocked(fs.readdirSync).mockReturnValue([
    { name: 'probe', isDirectory: () => true } as unknown as fs.Dirent,
  ] as unknown as ReturnType<typeof fs.readdirSync>);
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.agentDebug', () => {
  it('happy path: picks skill and dispatches /canopy-debug <skill> via claude CLI', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(
      { label: 'probe' } as unknown as vscode.QuickPickItem,
    );
    await agentDebug();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe('claude "/canopy-debug probe"');
  });

  it('cancel path: no skill selected → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    await agentDebug();
    expect(sendText).not.toHaveBeenCalled();
  });
});
