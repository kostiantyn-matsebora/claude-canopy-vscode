import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { activate } from '../extension';

// activate() touches many vscode.* registration APIs that the auto-loaded mock
// at src/__mocks__/vscode.ts does not provide. Stub them on the module surface
// so the inline `canopy.showVersion` registration is reachable.

type CommandHandler = (...args: unknown[]) => unknown;

interface FakeContext {
  subscriptions: { dispose: () => void }[];
  extension: { packageJSON: Record<string, unknown> };
}

function makeContext(packageJSON: Record<string, unknown>): FakeContext {
  return {
    subscriptions: [],
    extension: { packageJSON },
  };
}

describe('canopy.showVersion', () => {
  let registered: Map<string, CommandHandler>;
  let showInformationMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    registered = new Map();

    // Capture command registrations.
    (vscode.commands as unknown as { registerCommand: unknown }).registerCommand =
      (id: string, fn: CommandHandler) => {
        registered.set(id, fn);
        return { dispose: () => {} };
      };

    // Stubs for the language service registrations the activate() call also
    // performs — these are not relevant to canopy.showVersion but must not
    // throw.
    (vscode.languages as unknown as Record<string, unknown>).registerCompletionItemProvider =
      () => ({ dispose: () => {} });
    (vscode.languages as unknown as Record<string, unknown>).registerHoverProvider =
      () => ({ dispose: () => {} });
    (vscode.languages as unknown as Record<string, unknown>).registerDefinitionProvider =
      () => ({ dispose: () => {} });
    (vscode.languages as unknown as Record<string, unknown>).setTextDocumentLanguage =
      async () => undefined;

    // workspace.textDocuments is already [] in the mock; ensure it's iterable.
    Object.defineProperty(vscode.workspace, 'textDocuments', {
      value: [],
      configurable: true,
    });

    // Capture the info message argument.
    showInformationMessage = vi.fn(async () => undefined);
    (vscode.window as unknown as { showInformationMessage: unknown }).showInformationMessage =
      showInformationMessage;
  });

  afterEach(() => vi.restoreAllMocks());

  it('happy path: shows "Canopy Skills v<version> — Canopy framework v<canopyVersion>"', () => {
    const ctx = makeContext({ version: '0.11.0', canopyVersion: '0.18.0' });

    activate(ctx as unknown as vscode.ExtensionContext);

    const handler = registered.get('canopy.showVersion');
    expect(handler).toBeDefined();

    handler!();

    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect(showInformationMessage.mock.calls[0][0]).toBe(
      'Canopy Skills v0.11.0 — Canopy framework v0.18.0'
    );
  });

  it('fallback path: missing canopyVersion → "Canopy framework vunknown"', () => {
    const ctx = makeContext({ version: '0.11.0' });

    activate(ctx as unknown as vscode.ExtensionContext);

    const handler = registered.get('canopy.showVersion');
    expect(handler).toBeDefined();

    handler!();

    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    const msg = showInformationMessage.mock.calls[0][0] as string;
    expect(msg).toContain('Canopy framework vunknown');
    expect(msg).toContain('Canopy Skills v0.11.0');
  });
});
