import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { install } from '../commands/installCanopy';

vi.mock('../availability', () => ({
  detectTools: vi.fn(async () => ({ git: true, gh: true, claude: true })),
  isCommandAvailable: vi.fn(async () => true),
}));

describe('canopy.install', () => {
  let executeCommand: ReturnType<typeof vi.fn>;
  let showQuickPick: ReturnType<typeof vi.spyOn>;
  let showInputBox: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    executeCommand = vi.fn(async () => undefined);
    vscode.commands.executeCommand = executeCommand as unknown as typeof vscode.commands.executeCommand;
    showQuickPick = vi.spyOn(vscode.window, 'showQuickPick');
    showInputBox = vi.spyOn(vscode.window, 'showInputBox');

    // Single workspace folder — installAsAgentSkill needs this.
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
      configurable: true,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('happy path (gh-skill): picker selection dispatches to installAsAgentSkill', async () => {
    // Order of pickers in installAsAgentSkill flow:
    //   1. install-method picker (this command's own)         → return gh-skill
    //   2. gh install location picker (Claude/Copilot/Cross)  → cancel to stop chain
    let callCount = 0;
    showQuickPick.mockImplementation(async (items: unknown) => {
      callCount++;
      if (callCount === 1) {
        const arr = items as Array<{ method?: string }>;
        return arr.find(i => i.method === 'gh-skill') as unknown as undefined;
      }
      // Cancel any subsequent pickers — we only need to prove dispatch routed.
      return undefined;
    });
    showInputBox.mockResolvedValue(undefined);

    await install();

    // First picker must have been the install-method picker.
    const firstItems = showQuickPick.mock.calls[0]?.[0] as Array<{ method?: string }>;
    expect(Array.isArray(firstItems)).toBe(true);
    expect(firstItems.map(i => i.method)).toEqual(['install-script', 'gh-skill', 'plugin']);

    // Dispatch routed to installAsAgentSkill → it called the next picker
    // (gh install location: Claude Code / GitHub Copilot / Cross-client).
    expect(showQuickPick.mock.calls.length).toBeGreaterThanOrEqual(2);
    const secondItems = showQuickPick.mock.calls[1]?.[0] as Array<{ label: string }>;
    expect(Array.isArray(secondItems)).toBe(true);
    const labels = secondItems.map(i => i.label);
    expect(labels).toContain('Claude Code');
    expect(labels).toContain('GitHub Copilot');
  });

  it('cancel path: dismissing the method picker → no dispatch, no further prompts', async () => {
    showQuickPick.mockResolvedValue(undefined);
    showInputBox.mockResolvedValue(undefined);

    await install();

    expect(showQuickPick).toHaveBeenCalledTimes(1);
    expect(showInputBox).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
