export const Uri = {
  file: (p: string) => ({ fsPath: p, scheme: 'file', toString: () => `file://${p}` }),
};

export class Range {
  constructor(
    public readonly startLine: number,
    public readonly startChar: number,
    public readonly endLine: number,
    public readonly endChar: number,
  ) {}
}

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export enum DiagnosticSeverity { Error = 0, Warning = 1, Information = 2, Hint = 3 }

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity?: DiagnosticSeverity,
  ) {}
}

export const languages = {
  createDiagnosticCollection: () => ({ set: () => {}, delete: () => {}, dispose: () => {} }),
};

export const workspace = {
  getConfiguration: () => ({ get: (_: string, def: unknown) => def }),
  fs: { readFile: async () => new Uint8Array() },
  textDocuments: [],
  onDidOpenTextDocument: () => ({ dispose: () => {} }),
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
  onDidCloseTextDocument: () => ({ dispose: () => {} }),
  onDidSaveTextDocument: () => ({ dispose: () => {} }),
};

export const window = {
  activeTextEditor: undefined,
  createTerminal: (_: unknown) => ({
    show: () => {},
    sendText: (_t: string) => {},
    exitStatus: undefined,
  }),
  showInputBox: async (_: unknown) => undefined,
  showQuickPick: async (_: unknown) => undefined,
};

export const commands = {
  executeCommand: async (_: string, ..._args: unknown[]) => undefined,
};
