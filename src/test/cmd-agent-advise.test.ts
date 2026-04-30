import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentAdvise } from '../commands/canopyAgent';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn() };
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
  vi.mocked(fs.existsSync).mockImplementation((p) =>
    String(p).replace(/\\/g, '/').includes('skills/canopy-runtime/SKILL.md'),
  );
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.agentAdvise', () => {
  it('happy path: prompts for question and dispatches /canopy how to ...', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(
      'structure a skill that needs conditional branching',
    );
    await agentAdvise();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toContain(
      '/canopy how to structure a skill that needs conditional branching',
    );
  });

  it('cancel path: no input → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
    await agentAdvise();
    expect(sendText).not.toHaveBeenCalled();
  });
});
