import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { newSkill } from '../commands/newResource';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: { fsPath: '/proj' }, name: 'proj', index: 0 }],
    configurable: true,
  });
  // Skill directory does NOT yet exist (no SKILL.md, no skill.md anywhere) so handler proceeds.
  vi.mocked(fs.existsSync).mockReturnValue(false);
  // Stub out the open-document/info-message calls (not provided by the shared mock).
  (vscode.workspace as unknown as { openTextDocument: unknown }).openTextDocument = vi.fn(async () => ({}));
  (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument = vi.fn(async () => ({}));
  (vscode.window as unknown as { showInformationMessage: unknown }).showInformationMessage = vi.fn(async () => undefined);
  (vscode.window as unknown as { showErrorMessage: unknown }).showErrorMessage = vi.fn(async () => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('canopy.newSkill', () => {
  it('happy path: prompts for skill name and writes SKILL.md + references/ops.md', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('my-new-skill');

    await newSkill();

    const writeMock = vi.mocked(fs.writeFileSync);
    expect(writeMock).toHaveBeenCalledTimes(2);

    const writeCalls = writeMock.mock.calls.map(c => ({
      path: String(c[0]).replace(/\\/g, '/'),
      content: String(c[1]),
    }));

    const skillMd = writeCalls.find(c => c.path.endsWith('my-new-skill/SKILL.md'));
    const opsMd = writeCalls.find(c => c.path.endsWith('my-new-skill/references/ops.md'));

    expect(skillMd, 'SKILL.md write').toBeDefined();
    expect(opsMd, 'references/ops.md write').toBeDefined();
    expect(skillMd!.content).toContain('my-new-skill');
    expect(opsMd!.content).toContain('my-new-skill');
  });

  it('cancel path: showInputBox returns undefined → no writeFileSync', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);

    await newSkill();

    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled();
  });
});
