import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { installByCopy } from '../commands/installCanopy';

vi.mock('../availability', () => ({
  detectTools: vi.fn(async () => ({ git: true, gh: true, claude: true })),
  isCommandAvailable: vi.fn(async () => true),
}));

// Capture every command passed to execAsync (which is promisify(child_process.exec)).
// We intercept the underlying exec; promisify resolves on (null, {stdout, stderr}).
const execCalls: string[] = [];
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    exec: (cmd: string, _opts: unknown, cb?: (err: unknown, res: { stdout: string; stderr: string }) => void) => {
      execCalls.push(cmd);
      const callback = typeof _opts === 'function' ? _opts as typeof cb : cb;
      if (callback) callback(null, { stdout: '', stderr: '' });
      return {} as unknown as ReturnType<typeof child_process.exec>;
    },
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdtempSync: vi.fn((prefix: string) => `${prefix}TMPXXXX`),
    existsSync: vi.fn(() => false),
    rmSync: vi.fn(),
  };
});

beforeEach(() => {
  execCalls.length = 0;
  vi.clearAllMocks();

  // Single workspace folder.
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
    configurable: true,
  });

  // Stub vscode APIs the handler uses but the shared mock omits.
  // Use Object.assign because these properties are not declared on the mock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w: any = vscode.window;
  w.withProgress = async (_opts: unknown, task: () => Promise<unknown>) => task();
  w.createOutputChannel = vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  }));
  w.showInformationMessage = vi.fn(async () => undefined);
  w.showErrorMessage = vi.fn(async () => undefined);
  w.showWarningMessage = vi.fn(async () => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = vscode;
  v.ProgressLocation = { Notification: 15 };

  // mkdtempSync mocked above always returns a deterministic path.
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.installByCopy', () => {
  it('happy path: target=Claude, version empty → exec runs install script with --target claude / -Target claude', async () => {
    let pickCount = 0;
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (items: any) => {
        pickCount++;
        const arr = items as Array<{ label?: string; value?: unknown }>;
        if (pickCount === 1) {
          // pickTarget — return the Claude entry
          return arr.find(i => i.label === 'Claude') as unknown as undefined;
        }
        // pickSkills (canPickMany) — return all three with picked: true
        return arr as unknown as undefined;
      },
    );
    // pickVersion — empty string (means "latest", does NOT cancel).
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('');

    await installByCopy();

    // Expect at least 2 exec calls: git clone, then the install script.
    expect(execCalls.length).toBeGreaterThanOrEqual(2);

    const clone = execCalls[0];
    expect(clone).toContain('git clone');

    const install = execCalls.find(c => /install\.(sh|ps1)/.test(c));
    expect(install).toBeDefined();
    // Must reference the chosen target. On Unix → bash + --target claude;
    // on Windows → pwsh + -Target claude.
    if (process.platform === 'win32') {
      expect(install!).toContain('install.ps1');
      expect(install!).toContain('-Target claude');
    } else {
      expect(install!).toContain('install.sh');
      expect(install!).toContain('--target claude');
    }
    // No --version / -Version flag when empty version was provided.
    expect(install!).not.toMatch(/--version /);
    expect(install!).not.toMatch(/-Version /);
  });

  it('cancel path: dismissing the target picker → no exec calls', async () => {
    // First (and only) showQuickPick is the target picker — return undefined.
    vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue(undefined);
    const inputSpy = vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);

    await installByCopy();

    expect(execCalls).toEqual([]);
    expect(inputSpy).not.toHaveBeenCalled();
  });
});
