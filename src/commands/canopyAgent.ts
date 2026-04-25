/**
 * Commands that invoke canopy agent operations, per the documented runtimes:
 *  - Claude target  (runtimes/runtime-claude.md):   `/canopy <request>` — sent via the `claude` CLI
 *  - Copilot target (runtimes/runtime-copilot.md):  `Follow .github/skills/canopy/SKILL.md and <request>` — opened in VS Code Chat
 *
 * Project selection:
 *  - Walk up from the active editor file to the nearest ancestor containing
 *    `<base>/skills/canopy-runtime/SKILL.md` (.claude wins over .github).
 *  - If no active editor or no match, scan workspace folders. 0 → error, 1 → silent,
 *    N → QuickPick.
 *  - Terminals are cached per project root so each project gets its own terminal.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AiTarget, targetBaseDir, MARKER_START } from './installCanopy';
import { isCommandAvailable } from '../availability';

// v0.17.0 install layout: every canopy install ships canopy-runtime as the minimum.
// Its SKILL.md is the canonical project marker.
const FRAMEWORK_MARKERS = [
  path.join('skills', 'canopy-runtime', 'SKILL.md'),
];

/**
 * How canopy was installed in this project.
 * - 'file'   — skill files present on disk (install script, gh skill, submodule, copy)
 * - 'plugin' — Claude Code plugin install; no skill files; invocation uses /<plugin>:<skill> form
 */
export type InstallKind = 'file' | 'plugin';

// Skills shipped by claude-canopy itself; excluded from the user's pick list.
const FRAMEWORK_SKILL_NAMES = new Set(['canopy', 'canopy-debug', 'canopy-runtime']);

/** True if `dir/<file>` exists matching either case (skill.md or SKILL.md). */
function skillFileExists(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'SKILL.md')) || fs.existsSync(path.join(dir, 'skill.md'));
}

const terminals = new Map<string, vscode.Terminal>();

// ---------------------------------------------------------------------------
// Pure helpers (testable — no vscode APIs, no `fs`)
// ---------------------------------------------------------------------------

/**
 * Build the prompt routed to the canopy agent for the given platform.
 * Plugin installs use the namespaced form `/canopy:canopy <request>` instead of `/canopy <request>`.
 */
export function buildAgentPrompt(target: AiTarget, request: string, installKind: InstallKind = 'file'): string {
  const trimmed = request.trim();
  if (target === 'copilot') {
    return `Follow .github/skills/canopy/SKILL.md and ${trimmed}`;
  }
  return installKind === 'plugin' ? `/canopy:canopy ${trimmed}` : `/canopy ${trimmed}`;
}

/** Build the prompt for the canopy-debug trace wrapper (one skill at a time). */
export function buildDebugPrompt(target: AiTarget, skillName: string, installKind: InstallKind = 'file'): string {
  const trimmed = skillName.trim();
  if (target === 'copilot') {
    return `Follow .github/skills/canopy-debug/SKILL.md and trace ${trimmed}`;
  }
  return installKind === 'plugin' ? `/canopy:canopy-debug ${trimmed}` : `/canopy-debug ${trimmed}`;
}

/** Shell command for the Claude CLI (`claude "/canopy <request>"`). */
export function buildClaudeCliCommand(request: string, installKind: InstallKind = 'file'): string {
  const prompt = buildAgentPrompt('claude', request, installKind).replace(/"/g, '\\"');
  return `claude "${prompt}"`;
}

/** Shell command for the Claude CLI for canopy-debug (`claude "/canopy-debug <skill>"`). */
export function buildClaudeCliDebugCommand(skillName: string, installKind: InstallKind = 'file'): string {
  const prompt = buildDebugPrompt('claude', skillName, installKind).replace(/"/g, '\\"');
  return `claude "${prompt}"`;
}

/** Target and install kind at `root` if it is a canopy project, else undefined. Claude wins on ties. */
export function projectTargetAt(
  root: string,
  exists: (p: string) => boolean,
  readText?: (p: string) => string | undefined,
): { target: AiTarget; installKind: InstallKind } | undefined {
  for (const marker of FRAMEWORK_MARKERS) {
    if (exists(path.join(targetBaseDir(root, 'claude'), marker)))
      return { target: 'claude', installKind: 'file' };
  }
  for (const marker of FRAMEWORK_MARKERS) {
    if (exists(path.join(targetBaseDir(root, 'copilot'), marker)))
      return { target: 'copilot', installKind: 'file' };
  }
  // Plugin install writes no skill files — detect via the canopy-runtime marker block in CLAUDE.md.
  if (readText) {
    const content = readText(path.join(root, 'CLAUDE.md'));
    if (content?.includes(MARKER_START))
      return { target: 'claude', installKind: 'plugin' };
  }
  return undefined;
}

/** Walk up from `dir` (a directory) looking for a canopy project. */
export function findProjectUpward(
  dir: string,
  exists: (p: string) => boolean,
  readText?: (p: string) => string | undefined,
): { root: string; target: AiTarget; installKind: InstallKind } | undefined {
  let current = dir;
  // Guard against infinite loops on malformed paths.
  for (let i = 0; i < 64; i++) {
    const found = projectTargetAt(current, exists, readText);
    if (found) return { root: current, ...found };
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
  readText?: (p: string) => string | undefined,
): Array<{ root: string; target: AiTarget; installKind: InstallKind }> {
  if (hintPath) {
    const found = findProjectUpward(path.dirname(hintPath), exists, readText);
    if (found) return [found];
  }
  const out: Array<{ root: string; target: AiTarget; installKind: InstallKind }> = [];
  const seen = new Set<string>();
  for (const folder of folders) {
    if (seen.has(folder)) continue;
    const found = projectTargetAt(folder, exists, readText);
    if (found) {
      out.push({ root: folder, ...found });
      seen.add(folder);
    }
  }
  return out;
}

/**
 * If `activeFilePath` lives under the project's skills tree, return the skill name.
 * Covers `<base>/skills/<name>/...`. Excludes framework skills.
 */
export function detectCurrentSkill(
  activeFilePath: string | undefined,
  projectRoot: string,
  target: AiTarget,
): string | undefined {
  if (!activeFilePath) return undefined;
  const skillsRoot = path.join(targetBaseDir(projectRoot, target), 'skills');
  const prefix = skillsRoot + path.sep;
  if (!activeFilePath.startsWith(prefix)) return undefined;
  const rel = activeFilePath.slice(prefix.length);
  const first = rel.split(/[\\/]/, 1)[0];
  if (first && !FRAMEWORK_SKILL_NAMES.has(first)) return first;
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

function fsReadText(p: string): string | undefined {
  try { return fs.readFileSync(p, 'utf8'); } catch { return undefined; }
}

async function resolveCanopyProject(): Promise<{ root: string; target: AiTarget; installKind: InstallKind } | undefined> {
  const active = vscode.window.activeTextEditor?.document.uri.fsPath;
  const folders = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
  const candidates = resolveProjectFromPaths(active, folders, fs.existsSync, fsReadText);

  if (candidates.length === 0) {
    vscode.window.showErrorMessage(
      'No Canopy project found in this workspace. Use "Canopy Install: Install…" to add Canopy to this project.',
    );
    return undefined;
  }
  if (candidates.length === 1) return candidates[0];

  const items = candidates.map(c => ({
    label: `${path.basename(c.root)} (${c.target}${c.installKind === 'plugin' ? '/plugin' : ''})`,
    description: c.root,
  }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select Canopy project' });
  if (!picked) return undefined;
  return candidates.find(c => c.root === picked.description);
}

function listProjectSkills(projectRoot: string, target: AiTarget): string[] {
  const skillsRoot = path.join(targetBaseDir(projectRoot, target), 'skills');
  if (!fs.existsSync(skillsRoot)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || FRAMEWORK_SKILL_NAMES.has(entry.name)) continue;
    if (skillFileExists(path.join(skillsRoot, entry.name))) {
      out.push(entry.name);
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

async function ensureClaudeOrFail(): Promise<boolean> {
  if (await isCommandAvailable('claude')) return true;
  const choice = await vscode.window.showErrorMessage(
    'Claude Code CLI (claude) is not on PATH. Install Claude Code, or open this project in a Copilot workspace to use the Copilot target.',
    'Open Claude Code download',
    'Cancel',
  );
  if (choice === 'Open Claude Code download') {
    vscode.env.openExternal(vscode.Uri.parse('https://claude.ai/code'));
  }
  return false;
}

async function runOn(
  project: { root: string; target: AiTarget; installKind: InstallKind },
  request: string,
): Promise<void> {
  if (project.target === 'copilot') {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: buildAgentPrompt('copilot', request),
    });
    return;
  }
  if (!(await ensureClaudeOrFail())) return;
  const term = getTerminalFor(project.root);
  term.show(true);
  term.sendText(buildClaudeCliCommand(request, project.installKind));
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

// ---------------------------------------------------------------------------
// DEBUG (/canopy-debug <skill>) — trace wrapper, separate skill from /canopy
// ---------------------------------------------------------------------------

export async function agentDebug(): Promise<void> {
  const project = await resolveCanopyProject();
  if (!project) return;
  const skillName = await pickSkill(project.root, project.target, 'Skill to trace with canopy-debug');
  if (!skillName) return;

  if (project.target === 'copilot') {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: buildDebugPrompt('copilot', skillName),
    });
    return;
  }
  if (!(await ensureClaudeOrFail())) return;
  const term = getTerminalFor(project.root);
  term.show(true);
  term.sendText(buildClaudeCliDebugCommand(skillName, project.installKind));
}
