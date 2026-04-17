/**
 * Commands that invoke canopy agent operations via the Claude Code CLI or GitHub Copilot CLI.
 * Detects which AI tool has Canopy installed and uses the appropriate CLI.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiTarget, targetBaseDir } from './setupCanopy';

let agentTerminal: vscode.Terminal | undefined;

function getTerminal(cwd: string | undefined): vscode.Terminal {
  if (agentTerminal && agentTerminal.exitStatus === undefined) {
    return agentTerminal;
  }
  agentTerminal = vscode.window.createTerminal({
    name: 'Canopy Agent',
    cwd,
  });
  return agentTerminal;
}

function workspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  if (folders.length === 1) return folders[0].uri.fsPath;
  const active = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (active) {
    const match = folders.find(f => active.startsWith(f.uri.fsPath));
    if (match) return match.uri.fsPath;
  }
  return folders[0].uri.fsPath;
}

/** Returns which AI target has Canopy installed (framework ops.md present), or undefined if neither. */
function detectInstall(root: string): AiTarget | undefined {
  const marker = path.join('skills', 'shared', 'framework', 'ops.md');
  if (fs.existsSync(path.join(targetBaseDir(root, 'claude'), marker))) return 'claude';
  if (fs.existsSync(path.join(targetBaseDir(root, 'copilot'), marker))) return 'copilot';
  return undefined;
}

/** Builds the CLI invocation string for the detected target. */
function buildCliCommand(prompt: string, target: AiTarget | undefined): string {
  const escaped = prompt.replace(/"/g, '\\"');
  if (target === 'copilot') {
    return `gh copilot suggest "${escaped}"`;
  }
  return `claude "${escaped}"`;
}

function run(prompt: string): void {
  const cwd = workspaceRoot();
  const target = cwd ? detectInstall(cwd) : undefined;
  const term = getTerminal(cwd);
  term.show(true);
  term.sendText(buildCliCommand(prompt, target));
}

async function pickSkill(promptText: string): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const skills: string[] = [];
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const targets: AiTarget[] = ['claude', 'copilot'];
    for (const target of targets) {
      const base = path.join(targetBaseDir(root, target), 'skills');
      if (!fs.existsSync(base)) continue;
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (
          entry.isDirectory() &&
          entry.name !== 'shared' &&
          fs.existsSync(path.join(base, entry.name, 'skill.md')) &&
          !skills.includes(entry.name)
        ) {
          skills.push(entry.name);
        }
      }
    }
  }

  if (skills.length > 0) {
    const items: vscode.QuickPickItem[] = [
      ...skills.map(s => ({ label: s })),
      { label: '$(edit) Enter skill name manually', alwaysShow: true },
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: promptText });
    if (!picked) return undefined;
    if (picked.label.startsWith('$(edit)')) {
      return vscode.window.showInputBox({ prompt: promptText, placeHolder: 'skill-name' });
    }
    return picked.label;
  }

  return vscode.window.showInputBox({ prompt: promptText, placeHolder: 'skill-name' });
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export async function agentCreate(): Promise<void> {
  const description = await vscode.window.showInputBox({
    prompt: 'Describe the skill to create',
    placeHolder: 'e.g. bumps the version in package.json and updates CHANGELOG',
  });
  if (!description) return;
  run(`canopy: create a skill that ${description}`);
}

// ---------------------------------------------------------------------------
// MODIFY
// ---------------------------------------------------------------------------

export async function agentModify(): Promise<void> {
  const skillName = await pickSkill('Skill to modify');
  if (!skillName) return;
  const change = await vscode.window.showInputBox({
    prompt: `What should be changed in "${skillName}"?`,
    placeHolder: 'e.g. add a SHOW_PLAN step before the first op',
  });
  if (!change) return;
  run(`canopy: modify the ${skillName} skill — ${change}`);
}

// ---------------------------------------------------------------------------
// SCAFFOLD
// ---------------------------------------------------------------------------

export async function agentScaffold(): Promise<void> {
  const skillName = await vscode.window.showInputBox({
    prompt: 'New skill name (kebab-case)',
    placeHolder: 'my-skill',
    validateInput: v => /^[a-z][a-z0-9-]*$/.test(v) ? undefined : 'Must be kebab-case (e.g. my-skill)',
  });
  if (!skillName) return;
  run(`canopy: scaffold a blank skill named ${skillName}`);
}

// ---------------------------------------------------------------------------
// CONVERT_TO_CANOPY
// ---------------------------------------------------------------------------

export async function agentConvertToCanopy(): Promise<void> {
  const skillName = await pickSkill('Skill to convert to Canopy format');
  if (!skillName) return;
  run(`canopy: convert the ${skillName} skill to canopy format`);
}

// ---------------------------------------------------------------------------
// VALIDATE
// ---------------------------------------------------------------------------

export async function agentValidate(): Promise<void> {
  const skillName = await pickSkill('Skill to validate');
  if (!skillName) return;
  run(`canopy: validate the ${skillName} skill`);
}

// ---------------------------------------------------------------------------
// IMPROVE
// ---------------------------------------------------------------------------

export async function agentImprove(): Promise<void> {
  const skillName = await pickSkill('Skill to improve');
  if (!skillName) return;
  run(`canopy: improve the ${skillName} skill — align with framework rules`);
}

// ---------------------------------------------------------------------------
// ADVISE
// ---------------------------------------------------------------------------

export async function agentAdvise(): Promise<void> {
  const question = await vscode.window.showInputBox({
    prompt: 'What would you like advice on?',
    placeHolder: 'e.g. how to structure a skill that needs conditional branching',
  });
  if (!question) return;
  run(`canopy: how to ${question}`);
}

// ---------------------------------------------------------------------------
// REFACTOR_SKILLS
// ---------------------------------------------------------------------------

export async function agentRefactorSkills(): Promise<void> {
  run('canopy: refactor skills — extract common ops and resources');
}

// ---------------------------------------------------------------------------
// CONVERT_TO_REGULAR
// ---------------------------------------------------------------------------

export async function agentConvertToRegular(): Promise<void> {
  const skillName = await pickSkill('Skill to convert back to regular format');
  if (!skillName) return;
  run(`canopy: convert the ${skillName} skill back to a regular plain skill`);
}

// ---------------------------------------------------------------------------
// HELP
// ---------------------------------------------------------------------------

export async function agentHelp(): Promise<void> {
  run('canopy: help — list all operations');
}
