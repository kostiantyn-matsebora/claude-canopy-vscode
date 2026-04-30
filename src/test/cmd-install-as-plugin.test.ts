import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { installAsPlugin, FRAMEWORK_SKILLS } from '../commands/installCanopy';

// The handler does not call any availability probes, but some sibling modules
// require the mock — keep parity with cmd-install.test.ts.
vi.mock('../availability', () => ({
  detectTools: vi.fn(async () => ({ git: true, gh: true, claude: true })),
  isCommandAvailable: vi.fn(async () => true),
}));

describe('canopy.installAsPlugin', () => {
  let showQuickPick: ReturnType<typeof vi.spyOn>;
  let showInformationMessage: ReturnType<typeof vi.fn>;
  let showWarningMessage: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    showQuickPick = vi.spyOn(vscode.window, 'showQuickPick');

    showInformationMessage = vi.fn(async () => undefined);
    (vscode.window as unknown as { showInformationMessage: unknown }).showInformationMessage =
      showInformationMessage;

    showWarningMessage = vi.fn(async () => undefined);
    (vscode.window as unknown as { showWarningMessage: unknown }).showWarningMessage =
      showWarningMessage;

    writeText = vi.fn(async () => undefined);
    Object.defineProperty(vscode, 'env', {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    // Single workspace folder (handler does not strictly require it — repo
    // selection is config-driven — but mirror the rest of the suite).
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
      configurable: true,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('happy path: dispatches all three /plugin slash commands to the clipboard', async () => {
    // 1st picker = pickSkills (canPickMany). Return all three skills as
    // selected items so the warning prompt is skipped.
    showQuickPick.mockImplementation(async (items: unknown) => {
      const arr = items as Array<{ label: string }>;
      // pickSkills uses canPickMany → caller maps result to .label
      return arr as unknown as undefined;
    });
    // Each step's modal info message — click "Next →" twice, then "Done".
    showInformationMessage
      .mockResolvedValueOnce('Next →')
      .mockResolvedValueOnce('Next →')
      .mockResolvedValueOnce('Done');

    await installAsPlugin();

    // Three clipboard writes — one per slash command.
    expect(writeText).toHaveBeenCalledTimes(3);
    const dispatched = writeText.mock.calls.map((c) => c[0] as string);

    // Marker assertions for the three required commands.
    expect(dispatched[0]).toContain('/plugin marketplace add');
    expect(dispatched[1]).toContain('/plugin install');
    // Third command activates canopy-runtime in the project.
    expect(dispatched[2]).toContain('activate');
    expect(dispatched[2]).toMatch(/^\/canopy:canopy /);

    // Three info-message prompts (one per step).
    expect(showInformationMessage).toHaveBeenCalledTimes(3);
    // No warning shown when all framework skills are selected.
    expect(showWarningMessage).not.toHaveBeenCalled();
  });

  it('cancel path: dismissing the skill picker → no clipboard write, no info prompt', async () => {
    showQuickPick.mockResolvedValue(undefined);

    await installAsPlugin();

    expect(showQuickPick).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(showWarningMessage).not.toHaveBeenCalled();
    // Sanity: FRAMEWORK_SKILLS unchanged (used as a length check inside handler).
    expect(FRAMEWORK_SKILLS.length).toBe(3);
  });
});
