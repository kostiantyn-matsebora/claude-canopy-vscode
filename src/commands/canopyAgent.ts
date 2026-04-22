/**
 * Commands that invoke canopy agent operations, per the documented runtimes:
 *  - Claude target  (runtimes/claude.md):   `/canopy <request>` — sent via the `claude` CLI
 *  - Copilot target (runtimes/copilot.md):  `Follow .github/agents/canopy.md and <request>` — opened in VS Code Chat
 *
 * Project selection:
 *  - Walk up from the active editor file to the nearest ancestor containing
 *    `<base>/canopy/skills/shared/framework/ops.md` (.claude wins over .github).
 *  - If no active editor or no match, scan workspace folders. 0 → error, 1 → silent,
 *    N → QuickPick.
 *  - Terminals are cached per project root so each project gets its own terminal.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiTarget, targetBaseDir } from './setupCanopy';

const FRAMEWORK_MARKER = path.join('skills', 'shared', 'framework', 'ops.md');

const terminals = new Map<string, vscode.Terminal>();

// ---------------------------------------------------------------------------
// Pure helpers (testable — no vscode APIs, no `fs`)
// ---------------------------------------------------------------------------

/**
 * Build the prompt routed to the canopy agent for the given platform.
 * Shapes match runtimes/claude.md §Invocation and runtimes/copilot.md §Invocation.
 */
export function buildAgentPrompt(target: AiTarget, request: string): string {
  const trimmed = request.trim();
  if (target === 'copilot') {
    return `Follow .github/agents/canopy.md and ${trimmed}`;
  }
  return `/canopy ${trimmed}`;
}

/** Shell command for the Claude CLI (`claude "/canopy <request>"`). */
export function buildClaudeCliCommand(request: string): string {
  const prompt = buildAgentPrompt('claude', request).replace(/"/g, '\\"');
  return `claude "${prompt}"`;
}

/** Target at `root` if it is a canopy project, else undefined. Claude wins on ties. */
export function projectTargetAt(
  root: string,
  exists: (p: string) => boolean,
): AiTarget | undefined {
  if (exists(path.join(targetBaseDir(root, 'claude'), FRAMEWORK_MARKER))) return 'claude';
  if (exists(path.join(targetBaseDir(root, 'copilot'), FRAMEWORK_MARKER))) return 'copilot';
  return undefined;
}

/** Walk up from `dir` (a directory) looking for a canopy project. */
export function findProjectUpward(
  dir: string,
  exists: (p: string) => boolean,
): { root: string; target: AiTarget } | undefined {
  let current = dir;
  // Guard against infinite loops on malformed paths.
  for (let i = 0; i < 64; i++) {
    const target = projectTargetAt(current, exists);
    if (target) return { root: current, target };
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return undefined;
}

/**
 * Resolve candidate canopy projects for a dispatch call.
 * - If `hintPath` (a file path) is inside a project, return exactly that one.
 * - Otherwise return every workspace folder that is itself a project (0, 1, or N).
 */
export function resolveProjectFromPaths(
  hintPath: string | undefined,
  folders: string[],
  exists: (p: string) => boolean,
): Array<{ root: string; target: AiTarget }> {
  if (hintPath) {
    const found = findProjectUpward(path.dirname(hintPath), exists);
    if (found) return [found];
  }
  const out: Array<{ root: string; target: AiTarget }> = [];
  const seen = new Set<string>();
  for (const folder of folders) {
    if (seen.has(folder)) continue;
    const target = projectTargetAt(folder, exists);
    if (target) {
      out.push({ root: folder, target });
      seen.add(folder);
    }
  }
  return out;
}

/**
 * If `activeFilePath` lives under the project's skills tree, return the skill name.
 * Covers `<base>/skills/<name>/...` and `<base>/canopy/skills/<name>/...`.
 * Excludes `shared`.
 */
export function detectCurrentSkill(
  activeFilePath: string | undefined,
  projectRoot: string,
  target: AiTarget,
): string | undefined {
  if (!activeFilePath) return undefined;
  const base = targetBaseDir(projectRoot, target);
  const roots = [
    path.join(base, 'skills'),
    path.join(base, 'canopy', 'skills'),
  ];
  for (const skillsRoot of roots) {
    const prefix = skillsRoot + path.sep;
    if (!activeFilePath.startsWith(prefix)) continue;
    const rel = activeFilePath.slice(prefix.length);
    const first = rel.split(/[\\/]/, 1)[0];
    if (first && first !== 'shared') return first;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Runtime wiring (vscode + fs)
// ---------------------------------------------------------------------------

function getTerminalFor(root: string): vscode.Terminal {
  const existing = terminals.get(root);
  if (existing && existing.exitStatus === undefined) return existing;
  const term = vscode.window.createTerminal({
    name: `Canopy Agent (${path.basename(root)})`,
    cwd: root,
  });
  terminals.set(root, term);
  return term;
}

async function resolveCanopyProject(): Promise<{ root: string; target: AiTarget } | undefined> {
  const active = vscode.window.activeTextEditor?.document.uri.fsPath;
  const folders = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
  const candidates = resolveProjectFromPaths(active, folders, fs.existsSync);

  if (candidates.length === 0) {
    vscode.window.showErrorMessage(
      'No Canopy project found in this workspace. Run "Canopy: Add as copy" or "Add as submodule" first.',
    );
    return undefined;
  }
  if (candidates.length === 1) return candidates[0];

  const items = candidates.map(c => ({
    label: `${path.basename(c.root)} (${c.target})`,
    description: c.root,
  }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select Canopy project' });
  if (!picked) return undefined;
  return candidates.find(c => c.root === picked.description);
}

function listProjectSkills(projectRoot: string, target: AiTarget): string[] {
  const base = targetBaseDir(projectRoot, target);
  // When projectRoot is absolute, targetBaseDir returns an absolute path; join is a no-op.
  // When relative (tests), the same holds because targetBaseDir already prepends root.
  const dirs = [
    path.join(base, 'skills'),
    path.join(base, 'canopy', 'skills'),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'shared' || seen.has(entry.name)) continue;
      if (fs.existsSync(path.join(d, entry.name, 'skill.md'))) {
        out.push(entry.name);
        seen.add(entry.name);
      }
    }
  }
  return out.sort();
}

const CURRENT_PREFIX = '$(target) ';
const MANUAL_LABEL = '$(edit) Enter skill name manually';

async function pickSkill(
  root: string,
  target: AiTarget,
  promptText: string,
): Promise<string | undefined> {
  const skills = listProjectSkills(root, target);
  const active = vscode.window.activeTextEditor?.document.uri.fsPath;
  const current = detectCurrentSkill(active, root, target);

  const items: vscode.QuickPickItem[] = [];
  if (current) {
    items.push({ label: `${CURRENT_PREFIX}${current}`, description: 'current file' });
  }
  for (const s of skills) {
    if (s === current) continue;
    items.push({ label: s });
  }
  items.push({ label: MANUAL_LABEL, alwaysShow: true });

  const picked = await vscode.window.showQuickPick(items, { placeHolder: promptText });
  if (!picked) return undefined;
  if (picked.label === MANUAL_LABEL) {
    return vscode.window.showInputBox({ prompt: promptText, placeHolder: 'skill-name' });
  }
  return picked.label.startsWith(CURRENT_PREFIX)
    ? picked.label.slice(CURRENT_PREFIX.length)
    : picked.label;
}

async function runOn(
  project: { root: string; target: AiTarget },
  request: string,
): Promise<void> {
  if (project.target === 'copilot') {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: buildAgentPrompt('copilot', request),
    });
    return;
  }
  const term = getTerminalFor(project.root);
  term.show(true);
  term.sendText(buildClaudeCliCommand(request));
}

async function run(request: string): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  await runOn(project, request);
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
  await run(`create a skill that ${description}`);
}

// ---------------------------------------------------------------------------
// MODIFY
// ---------------------------------------------------------------------------

export async function agentModify(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to modify');
  if (!skillName) return;
  const change = await vscode.window.showInputBox({
    prompt: `What should be changed in "${skillName}"?`,
    placeHolder: 'e.g. add a SHOW_PLAN step before the first op',
  });
  if (!change) return;
  await runOn(project, `modify the ${skillName} skill — ${change}`);
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
  await run(`scaffold a blank skill named ${skillName}`);
}

// ---------------------------------------------------------------------------
// CONVERT_TO_CANOPY
// ---------------------------------------------------------------------------

export async function agentConvertToCanopy(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to convert to Canopy format');
  if (!skillName) return;
  await runOn(project, `convert the ${skillName} skill to canopy format`);
}

// ---------------------------------------------------------------------------
// VALIDATE
// ---------------------------------------------------------------------------

export async function agentValidate(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to validate');
  if (!skillName) return;
  await runOn(project, `validate the ${skillName} skill`);
}

// ---------------------------------------------------------------------------
// IMPROVE
// ---------------------------------------------------------------------------

export async function agentImprove(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to improve');
  if (!skillName) return;
  await runOn(project, `improve the ${skillName} skill — align with framework rules`);
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
  await run(`how to ${question}`);
}

// ---------------------------------------------------------------------------
// REFACTOR_SKILLS
// ---------------------------------------------------------------------------

export async function agentRefactorSkills(): Promise<void> {
  await run('refactor skills — extract common ops and resources');
}

// ---------------------------------------------------------------------------
// CONVERT_TO_REGULAR
// ---------------------------------------------------------------------------

export async function agentConvertToRegular(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to convert back to regular format');
  if (!skillName) return;
  await runOn(project, `convert the ${skillName} skill back to a regular plain skill`);
}

// ---------------------------------------------------------------------------
// HELP
// ---------------------------------------------------------------------------

export async function agentHelp(): Promise<void> {
  await run('help — list all operations');
}
