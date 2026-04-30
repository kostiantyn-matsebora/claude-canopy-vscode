import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentRefactorSkills } from '../commands/canopyAgent';

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

describe('canopy.agentRefactorSkills', () => {
  it('happy path: dispatches /canopy refactor skills with no input prompt', async () => {
    const showInputBoxSpy = vi.spyOn(vscode.window, 'showInputBox');
    await agentRefactorSkills();
    expect(showInputBoxSpy).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe(
      'claude "/canopy refactor skills — extract common ops and resources"',
    );
  });

  it('no-project path: missing canopy-runtime marker → no dispatch', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    (vscode.window as unknown as { showErrorMessage: (...a: unknown[]) => unknown }).showErrorMessage =
      vi.fn(async () => undefined);
    await agentRefactorSkills();
    expect(sendText).not.toHaveBeenCalled();
  });
});
