import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { installAsAgentSkill } from '../commands/installCanopy';

// ---------------------------------------------------------------------------
// Mocks (hoisted) — must be declared before handler import is resolved.
// ---------------------------------------------------------------------------

vi.mock('../availability', () => ({
  detectTools: vi.fn(async () => ({ git: true, gh: true, claude: true })),
  isCommandAvailable: vi.fn(async () => true),
}));

// child_process.exec is wrapped via util.promisify(exec) at module load. The
// promisified form calls the underlying exec with (cmd, options, callback) and
// resolves when callback(null, { stdout, stderr }) fires. We capture every cmd
// passed to exec so tests can assert what `gh skill install …` invocations ran.
const execCalls: string[] = [];
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    exec: (
      cmd: string,
      optionsOrCallback?: unknown,
      maybeCallback?: unknown,
    ) => {
      execCalls.push(cmd);
      const cb = (typeof optionsOrCallback === 'function'
        ? optionsOrCallback
        : maybeCallback) as ((err: Error | null, result: { stdout: string; stderr: string }) => void) | undefined;
      if (cb) cb(null, { stdout: '', stderr: '' });
      return undefined as unknown as ReturnType<typeof actual.exec>;
    },
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('canopy.installAsAgentSkill', () => {
  let showQuickPick: ReturnType<typeof vi.spyOn>;
  let showInputBox: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    execCalls.length = 0;

    // Single workspace folder — pickWorkspaceFolder short-circuits to it.
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
      configurable: true,
    });

    // Mock vscode.window.withProgress (not in the shared mock): invoke the task.
    (vscode.window as unknown as { withProgress: unknown }).withProgress =
      async (_opts: unknown, task: () => Promise<unknown>) => task();

    // Mock vscode.ProgressLocation enum used in withProgress options.
    (vscode as unknown as { ProgressLocation: Record<string, number> }).ProgressLocation =
      { Notification: 15, SourceControl: 1, Window: 10 };

    // Mock createOutputChannel so getOutput() in the handler doesn't blow up.
    (vscode.window as unknown as { createOutputChannel: unknown }).createOutputChannel =
      () => ({ show: () => {}, appendLine: () => {}, dispose: () => {} });

    // Suppress info / error toasts so tests don't fail on unmocked calls.
    (vscode.window as unknown as { showInformationMessage: unknown }).showInformationMessage =
      vi.fn(async () => undefined);
    (vscode.window as unknown as { showErrorMessage: unknown }).showErrorMessage =
      vi.fn(async () => undefined);
    (vscode.window as unknown as { showWarningMessage: unknown }).showWarningMessage =
      vi.fn(async () => undefined);

    showQuickPick = vi.spyOn(vscode.window, 'showQuickPick');
    showInputBox = vi.spyOn(vscode.window, 'showInputBox');
  });

  afterEach(() => vi.restoreAllMocks());

  it('happy path: claude-code agent + canopy-runtime → exec gh skill install with right flags', async () => {
    // pickGhInstallChoice → pickSkills (multi-pick).
    let qpCall = 0;
    showQuickPick.mockImplementation(async () => {
      qpCall++;
      if (qpCall === 1) {
        // pickGhInstallChoice — handler does `choice?.value`, so the picked
        // item must carry a `.value` of GhInstallChoice shape.
        return { label: 'Claude Code', value: { kind: 'agent', agent: 'claude-code' } } as unknown as undefined;
      }
      if (qpCall === 2) {
        // pickSkills — multi-pick; handler reads `.label` off each item.
        return [{ label: 'canopy-runtime', description: '', picked: true }] as unknown as undefined;
      }
      return undefined;
    });
    // pickVersion — empty string means "latest" (master); handler accepts ''.
    showInputBox.mockResolvedValue('' as unknown as string);

    await installAsAgentSkill();

    // Expect exactly one exec invocation (single skill picked).
    expect(execCalls.length).toBe(1);
    const cmd = execCalls[0];
    expect(cmd).toContain('gh skill install');
    expect(cmd).toContain('kostiantyn-matsebora/claude-canopy');
    expect(cmd).toContain('canopy-runtime');
    expect(cmd).toContain('--agent claude-code');
    // Version was empty → no --pin flag.
    expect(cmd).not.toContain('--pin');

    // Pickers were both invoked, then version input.
    expect(showQuickPick).toHaveBeenCalledTimes(2);
    expect(showInputBox).toHaveBeenCalledTimes(1);
  });

  it('cancel path: dismissing the gh-install-choice picker → no exec, no further prompts', async () => {
    showQuickPick.mockResolvedValue(undefined);
    showInputBox.mockResolvedValue(undefined);

    await installAsAgentSkill();

    expect(showQuickPick).toHaveBeenCalledTimes(1);
    expect(showInputBox).not.toHaveBeenCalled();
    expect(execCalls.length).toBe(0);
  });
});
