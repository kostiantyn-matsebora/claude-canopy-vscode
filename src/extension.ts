import * as vscode from 'vscode';
import { CanopyCompletionProvider } from './providers/completionProvider';
import { CanopyHoverProvider } from './providers/hoverProvider';
import { CanopyDefinitionProvider } from './providers/definitionProvider';
import { CanopyDiagnosticsProvider } from './providers/diagnosticsProvider';
import { registry } from './opRegistry';
import { install, installByCopy, installAsAgentSkill, installAsPlugin } from './commands/installCanopy';
import {
  newSkill, newVerifyFile, newTemplate, newConstantsFile,
  newPolicyFile, newCommandsFile, newSchema,
} from './commands/newResource';
import {
  agentCreate, agentModify, agentScaffold, agentConvertToCanopy,
  agentValidate, agentImprove, agentAdvise, agentRefactorSkills,
  agentConvertToRegular, agentHelp, agentDebug,
} from './commands/canopyAgent';

const CANOPY_LANG = 'canopy';

const CANOPY_FILE_RE = [
  /[/\\]\.claude[/\\].*[/\\]skill\.md$/i,
  /[/\\]\.claude[/\\].*[/\\]ops\.md$/i,
  /[/\\]\.github[/\\].*[/\\]skill\.md$/i,
  /[/\\]\.github[/\\].*[/\\]ops\.md$/i,
];

function isCanopyFile(fsPath: string): boolean {
  return CANOPY_FILE_RE.some(p => p.test(fsPath));
}

async function ensureCanopyLanguage(doc: vscode.TextDocument): Promise<void> {
  if (doc.languageId !== CANOPY_LANG && isCanopyFile(doc.uri.fsPath)) {
    await vscode.languages.setTextDocumentLanguage(doc, CANOPY_LANG);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = new CanopyDiagnosticsProvider();

  // --- Completion ---
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: CANOPY_LANG },
      new CanopyCompletionProvider(),
      ' ', '<', '`', '#', '\n'
    )
  );

  // --- Hover ---
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: CANOPY_LANG },
      new CanopyHoverProvider()
    )
  );

  // --- Go to definition ---
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: CANOPY_LANG },
      new CanopyDefinitionProvider()
    )
  );

  // --- Diagnostics on open and change ---
  const runDiagnostics = (document: vscode.TextDocument) => {
    if (document.languageId !== CANOPY_LANG) return;
    diagnostics.validate(document);
  };

  if (vscode.window.activeTextEditor) {
    runDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(runDiagnostics),
    vscode.workspace.onDidChangeTextDocument(e => runDiagnostics(e.document)),
    vscode.workspace.onDidCloseTextDocument(doc => diagnostics.clear(doc.uri))
  );

  // --- Invalidate op registry cache when ops.md files change ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.fileName.endsWith('ops.md')) {
        registry.invalidate(e.document.uri);
      }
    }),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.fileName.endsWith('ops.md')) {
        registry.invalidate(doc.uri);
      }
    })
  );

  // --- Enforce canopy language for files that another extension may have claimed ---
  vscode.workspace.textDocuments.forEach(ensureCanopyLanguage);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(ensureCanopyLanguage)
  );

  // --- Run diagnostics on all currently open canopy documents ---
  vscode.workspace.textDocuments.forEach(runDiagnostics);

  // --- Setup commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('canopy.showVersion', () => {
      const pkg = context.extension.packageJSON;
      vscode.window.showInformationMessage(
        `Canopy Skills v${pkg.version} — Canopy framework v${pkg.canopyVersion ?? 'unknown'}`
      );
    }),
    vscode.commands.registerCommand('canopy.install', install),
    vscode.commands.registerCommand('canopy.installByCopy', installByCopy),
    vscode.commands.registerCommand('canopy.installAsAgentSkill', installAsAgentSkill),
    vscode.commands.registerCommand('canopy.installAsPlugin', installAsPlugin),
  );

  // --- New resource commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('canopy.newSkill', newSkill),
    vscode.commands.registerCommand('canopy.newVerifyFile', newVerifyFile),
    vscode.commands.registerCommand('canopy.newTemplate', newTemplate),
    vscode.commands.registerCommand('canopy.newConstantsFile', newConstantsFile),
    vscode.commands.registerCommand('canopy.newPolicyFile', newPolicyFile),
    vscode.commands.registerCommand('canopy.newCommandsFile', newCommandsFile),
    vscode.commands.registerCommand('canopy.newSchema', newSchema),
  );

  // --- Canopy agent operation commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('canopy.agentCreate', agentCreate),
    vscode.commands.registerCommand('canopy.agentModify', agentModify),
    vscode.commands.registerCommand('canopy.agentScaffold', agentScaffold),
    vscode.commands.registerCommand('canopy.agentConvertToCanopy', agentConvertToCanopy),
    vscode.commands.registerCommand('canopy.agentValidate', agentValidate),
    vscode.commands.registerCommand('canopy.agentImprove', agentImprove),
    vscode.commands.registerCommand('canopy.agentAdvise', agentAdvise),
    vscode.commands.registerCommand('canopy.agentRefactorSkills', agentRefactorSkills),
    vscode.commands.registerCommand('canopy.agentConvertToRegular', agentConvertToRegular),
    vscode.commands.registerCommand('canopy.agentHelp', agentHelp),
    vscode.commands.registerCommand('canopy.agentDebug', agentDebug),
  );

  context.subscriptions.push(diagnostics);
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are in context.subscriptions
}
