import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { agentScaffold } from '../commands/canopyAgent';

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

describe('canopy.agentScaffold', () => {
  it('happy path: prompts for kebab-case skill name and dispatches /canopy scaffold', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('my-skill');
    await agentScaffold();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0]).toBe(
      'claude "/canopy scaffold a blank skill named my-skill"',
    );
  });

  it('validateInput rejects non-kebab-case and accepts kebab-case', async () => {
    const showInputBox = vi
      .spyOn(vscode.window, 'showInputBox')
      .mockResolvedValue(undefined);
    await agentScaffold();
    expect(showInputBox).toHaveBeenCalledTimes(1);
    const opts = showInputBox.mock.calls[0][0] as vscode.InputBoxOptions;
    expect(typeof opts.validateInput).toBe('function');
    const validate = opts.validateInput!;
    const badResult = validate('Bad Name', undefined as never);
    const goodResult = validate('good-name', undefined as never);
    expect(typeof badResult).toBe('string');
    expect(badResult as string).toMatch(/kebab-case/);
    expect(goodResult).toBeUndefined();
  });

  it('cancel path: no input → no dispatch', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
    await agentScaffold();
    expect(sendText).not.toHaveBeenCalled();
  });
});
