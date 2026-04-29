/**
 * Canopy install commands (v0.17.0+):
 *  - canopy.installByCopy        — clone canopy + run install.sh / install.ps1 (Claude or Copilot)
 *  - canopy.installAsAgentSkill  — gh skill install per-skill (Claude Code or GitHub Copilot)
 *  - canopy.installAsPlugin      — copies /plugin slash commands to clipboard (Claude Code only)
 *
 * All three prompt for skill selection (canopy / canopy-runtime / canopy-debug, all
 * checked by default). The first two also prompt for target (claude or copilot).
 * Plugin install bundles all three skills together — selection is informational.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { detectTools, isCommandAvailable, ToolAvailability } from '../availability';

const execAsync = promisify(exec);

/**
 * Install target for canopy framework skills.
 *  - 'claude'  — installs to .claude/skills/, marker block in CLAUDE.md
 *  - 'copilot' — installs to .github/skills/, marker block in .github/copilot-instructions.md
 *  - 'agents'  — Cross-client install (agentskills.io spec): installs to .agents/skills/.
 *                canopy-runtime self-identifies the host at runtime, so a single .agents/
 *                install serves both Claude Code and Copilot. Marker block goes to whichever
 *                instructions file already exists; CLAUDE.md is created as fallback.
 */
export type AiTarget = 'claude' | 'copilot' | 'agents';
export type GhAgent = 'claude-code' | 'github-copilot';

export const FRAMEWORK_SKILLS = ['canopy', 'canopy-runtime', 'canopy-debug'] as const;
export type FrameworkSkill = typeof FRAMEWORK_SKILLS[number];

const SKILL_DESCRIPTIONS: Record<FrameworkSkill, string> = {
  canopy: 'Authoring agent — create/modify/validate skills (depends on canopy-runtime)',
  'canopy-runtime': 'Execution engine — required to run any canopy-flavored skill',
  'canopy-debug': 'Trace wrapper — /canopy-debug for live phase + per-node tracing',
};

const DEFAULT_CANOPY_REPO = 'kostiantyn-matsebora/claude-canopy';
const DEFAULT_CANOPY_URL = `https://github.com/${DEFAULT_CANOPY_REPO}`;
const PLUGIN_NAME = 'canopy';
const MARKETPLACE_NAME = 'claude-canopy';

export const MARKER_START = '<!-- canopy-runtime-begin -->';
export const MARKER_END = '<!-- canopy-runtime-end -->';

/**
 * Marker block content. Mirrors `build_marker_block()` in claude-canopy/install.sh.
 * Re-enacted here because gh skill install does NOT write ambient instruction
 * files; we must do it ourselves so canopy-runtime is auto-loaded.
 */
export const MARKER_BLOCK = [
  '<!-- canopy-runtime-begin -->',
  '## Canopy Runtime',
  '',
  '**Trigger:** any `SKILL.md` declaring a `## Tree` section is a canopy-flavored skill. Before interpreting it, load `<skills-root>/canopy-runtime/SKILL.md` and apply its execution model.',
  '',
  '- **`<skills-root>` resolution** — first match wins:',
  '  - `.agents/skills/` — cross-agent install (gh skill install default on Copilot and other hosts)',
  '  - `.claude/skills/` — Claude Code',
  '  - `.github/skills/` — GitHub Copilot',
  '- **Platform detection** — at runtime, the agent self-identifies the active host:',
  '  - Claude Code → apply `<skills-root>/canopy-runtime/references/runtime-claude.md`',
  '  - GitHub Copilot → apply `<skills-root>/canopy-runtime/references/runtime-copilot.md`',
  '  - Other hosts → halt with unsupported-platform error',
  '- **Sections** — `## Agent`, `## Tree`, `## Rules`, `## Response:`',
  '- **Tree notation** — `<<` input, `>>` output, `|` separator',
  '- **Primitives** (defined in canopy-runtime\'s `references/framework-ops.md`):',
  '  - control flow — `IF`, `ELSE_IF`, `ELSE`, `SWITCH`, `CASE`, `DEFAULT`, `FOR_EACH`, `BREAK`, `END`',
  '  - interaction — `ASK`, `SHOW_PLAN`',
  '  - execution — `EXPLORE`, `VERIFY_EXPECTED`',
  '- **Op lookup chain** — first match wins:',
  '  - skill-local: `<skill>/references/ops.md` or `<skill>/references/ops/<name>.md` (legacy `<skill>/ops.md` at root also supported)',
  '  - consumer-defined cross-skill ops, if any',
  '  - framework primitives in canopy-runtime\'s `references/framework-ops.md`',
  '- **Category layout** (under each skill):',
  '  - `scripts/` — executable code',
  '  - `references/` — docs loaded on demand (including ops)',
  '  - `assets/{templates,constants,schemas,checklists,policies,verify}/` — static resources',
  '  - Legacy flat layout (these dirs at skill root) remains supported.',
  '- **Subagent contract** — `EXPLORE` is the first tree node when `## Agent` declares `**explore**`.',
  '<!-- canopy-runtime-end -->',
].join('\n');

// ---------------------------------------------------------------------------
// Pure helpers (testable — no vscode APIs, no fs, no child_process)
// ---------------------------------------------------------------------------

/** Resolve "owner/name" from a GitHub URL or "owner/name" shorthand. */
export function parseGithubRepo(url: string): string | undefined {
  const trimmed = url.trim().replace(/\.git$/, '');
  // owner/name shorthand
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  // https://github.com/owner/name  or  git@github.com:owner/name
  const m = trimmed.match(/github\.com[/:]([\w.-]+\/[\w.-]+)$/);
  return m ? m[1] : undefined;
}

/** Base directory under a workspace root for an AI target. */
export function targetBaseDir(root: string, target: AiTarget): string {
  switch (target) {
    case 'copilot': return path.join(root, '.github');
    case 'agents':  return path.join(root, '.agents');
    case 'claude':
    default:        return path.join(root, '.claude');
  }
}

/**
 * `gh skill install` command for a single skill.
 *
 * `loc` is either an `--agent <id>` selector or an explicit `--dir <path>`
 * (used for Cross-client installs at `.agents/skills/`).
 */
export function buildGhSkillCommand(
  repo: string,
  skill: FrameworkSkill,
  loc: GhInstallChoice | GhAgent,
  version?: string,
  scope: 'project' | 'user' = 'project',
): string {
  const pin = version ? ` --pin v${version}` : '';
  // Backward-compat: a bare GhAgent string is treated as { kind: 'agent', agent: ... }
  const choice: GhInstallChoice = typeof loc === 'string'
    ? { kind: 'agent', agent: loc }
    : loc;
  if (choice.kind === 'dir') {
    return `gh skill install ${repo} ${skill} --dir ${choice.dir}${pin} --force`;
  }
  return `gh skill install ${repo} ${skill} --agent ${choice.agent} --scope ${scope}${pin} --force`;
}

/** Shell command to invoke install.sh / install.ps1 from a cloned canopy tree. */
export function buildInstallScriptCommand(
  scriptPath: string,
  target: AiTarget,
  version: string | undefined,
  isWindows: boolean,
): string {
  const quoted = `"${scriptPath}"`;
  if (isWindows) {
    const v = version ? ` -Version ${version}` : '';
    return `pwsh -NoProfile -ExecutionPolicy Bypass -File ${quoted} -Target ${target}${v}`;
  }
  const v = version ? ` --version ${version}` : '';
  return `bash ${quoted} --target ${target}${v}`;
}

/**
 * Three slash commands the user runs in a Claude Code session, in order:
 *   1. Register the marketplace (one-time, user-scope)
 *   2. Install the canopy plugin bundle (one-time, user-scope)
 *   3. Activate canopy-runtime in the current project — writes the marker
 *      block to CLAUDE.md / .github/copilot-instructions.md so user-authored
 *      canopy skills under .claude/skills/ are runtime-active. Required for
 *      the plugin install path; install.sh / install.ps1 / the vscode
 *      extension's gh-skill flow write the block automatically.
 */
export function pluginInstallSlashCommands(repo: string): string[] {
  return [
    `/plugin marketplace add ${repo}`,
    `/plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
    `/${PLUGIN_NAME}:${PLUGIN_NAME} activate`,
  ];
}

export type InstallMethod = 'install-script' | 'gh-skill' | 'plugin';

export interface InstallMethodPick {
  method: InstallMethod;
  label: string;
  description: string;
  detail: string;
  available: boolean;
}

/**
 * Render Quick Pick items for the three install methods, annotated with
 * tool-availability badges. Pure: takes a tool snapshot, returns items.
 *
 *   - $(check)   = required tool present; recommended path
 *   - $(warning) = required tool missing; selecting still routes to handler so
 *                  the user gets a helpful install link / fallback offer
 *   - $(zap)     = optional tool; missing isn't blocking (plugin works without)
 */
export function buildInstallMethodPicks(tools: ToolAvailability): InstallMethodPick[] {
  return [
    {
      method: 'install-script',
      label: `${tools.git ? '$(check)' : '$(warning)'} Install (via install script)`,
      description: 'Claude / Copilot / Cross-client — clone canopy + run install.sh / install.ps1',
      detail: tools.git
        ? 'git ✓ — recommended for project-local installs with ambient activation'
        : 'git not found on PATH — install git first or pick another method',
      available: tools.git,
    },
    {
      method: 'gh-skill',
      label: `${tools.gh ? '$(check)' : '$(warning)'} Install as Agent Skill (gh skill)`,
      description: 'Claude / Copilot / Cross-client — gh skill install per skill',
      detail: tools.gh
        ? 'gh skill ✓ — version-pinned per-skill installs'
        : 'gh skill subcommand not available — install or upgrade to gh 2.90.0+ (cli.github.com)',
      available: tools.gh,
    },
    {
      method: 'plugin',
      label: `${tools.claude ? '$(check)' : '$(zap)'} Install as Claude Code Plugin`,
      description: 'Claude Code only — /plugin marketplace add + /plugin install',
      detail: tools.claude
        ? 'claude ✓ — can open in terminal for paste-and-run'
        : 'claude CLI not detected — slash commands will be copied to clipboard for manual paste',
      available: true, // plugin path always works (clipboard fallback)
    },
  ];
}

/** Resolve the ambient instruction file path for a given gh-skill agent. */
export function ambientInstructionFile(root: string, agent: GhAgent): string {
  return agent === 'github-copilot'
    ? path.join(root, '.github', 'copilot-instructions.md')
    : path.join(root, 'CLAUDE.md');
}

/**
 * Resolve ambient instruction destination(s) for a Cross-client install
 * (`gh skill install ... --dir .agents/skills`). Cross-client installs serve
 * both Claude Code and Copilot, so write to whichever instructions files
 * already exist; fall back to CLAUDE.md if neither exists.
 */
export function crossClientAmbientFiles(
  root: string,
  exists: (p: string) => boolean,
): string[] {
  const claude = path.join(root, 'CLAUDE.md');
  const copilot = path.join(root, '.github', 'copilot-instructions.md');
  const out: string[] = [];
  if (exists(claude)) out.push(claude);
  if (exists(copilot)) out.push(copilot);
  return out.length === 0 ? [claude] : out;
}

export type MarkerBlockResult =
  | { kind: 'created'; path: string }
  | { kind: 'appended'; path: string }
  | { kind: 'replaced'; path: string; warning?: string }
  | { kind: 'unchanged'; path: string }
  | { kind: 'malformed'; path: string; beginCount: number; endCount: number };

/**
 * Pure idempotent transform: given the existing file content and the marker block
 * to write, return the new content (or a malformed/unchanged signal).
 *
 * Mirrors the contract in claude-canopy/install.sh `write_marker_block()`:
 *  - no file (existing == undefined)             → emit block alone
 *  - no markers in file                          → append with blank-line separator
 *  - exactly one pair of markers                 → replace between them
 *  - multiple pairs                              → replace first, warn
 *  - unmatched markers (begin != end count)      → return malformed
 */
export function applyMarkerBlock(
  existing: string | undefined,
  block: string = MARKER_BLOCK,
  start: string = MARKER_START,
  end: string = MARKER_END,
): { content?: string; warning?: string; kind: MarkerBlockResult['kind']; beginCount?: number; endCount?: number } {
  if (existing === undefined) {
    return { kind: 'created', content: block + '\n' };
  }

  const lines = existing.split(/\r?\n/);
  const beginCount = lines.filter(l => l === start).length;
  const endCount = lines.filter(l => l === end).length;

  if (beginCount !== endCount) {
    return { kind: 'malformed', beginCount, endCount };
  }

  if (beginCount === 0) {
    // Append with blank-line separator. Preserve trailing newline behavior.
    const trailingNewline = existing.length === 0 || existing.endsWith('\n');
    const sep = trailingNewline ? '\n' : '\n\n';
    const content = existing + (existing.length === 0 ? '' : sep) + block + '\n';
    if (content === existing) return { kind: 'unchanged', content };
    return { kind: 'appended', content };
  }

  // Replace the first marker pair only.
  const out: string[] = [];
  let replaced = false;
  let inBlock = false;
  for (const line of lines) {
    if (!replaced && line === start) {
      out.push(...block.split('\n'));
      inBlock = true;
      replaced = true;
      continue;
    }
    if (inBlock && line === end) {
      inBlock = false;
      continue;
    }
    if (inBlock) continue;
    out.push(line);
  }
  const content = out.join('\n');
  const warning = beginCount > 1
    ? `Warning: ${beginCount} canopy-runtime marker pairs found; only the first was rewritten. Clean up the rest manually.`
    : undefined;
  if (content === existing) return { kind: 'unchanged', content, warning };
  return { kind: 'replaced', content, warning };
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

let output: vscode.OutputChannel | undefined;
function getOutput(): vscode.OutputChannel {
  if (!output) output = vscode.window.createOutputChannel('Canopy Install');
  return output;
}
function log(msg: string): void {
  getOutput().appendLine(msg);
}

function canopyUrl(): string {
  return vscode.workspace
    .getConfiguration('canopy')
    .get<string>('frameworkUrl', DEFAULT_CANOPY_URL);
}

function canopyRepo(): string {
  return parseGithubRepo(canopyUrl()) ?? DEFAULT_CANOPY_REPO;
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({
    placeHolder: 'Select workspace to install Canopy in',
  });
}

async function pickTarget(): Promise<AiTarget | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Claude', description: '.claude/skills/  — Claude Code', value: 'claude' as AiTarget },
      { label: 'GitHub Copilot', description: '.github/skills/  — GitHub Copilot', value: 'copilot' as AiTarget },
      {
        label: 'Cross-client',
        description: '.agents/skills/  — works on any agentskills.io-compatible host',
        detail: 'Single install serves both Claude Code and Copilot; runtime auto-detects the host',
        value: 'agents' as AiTarget,
      },
    ],
    { placeHolder: 'Select install target' },
  );
  return choice?.value;
}

/**
 * Result from the gh-skill agent picker.
 *  - { agent: 'claude-code' }    → gh skill install ... --agent claude-code  (.claude/skills/)
 *  - { agent: 'github-copilot' } → gh skill install ... --agent github-copilot (.agents/skills/ on gh 2.91+)
 *  - { dir: '.agents/skills' }   → gh skill install ... --dir .agents/skills (Cross-client, explicit)
 */
export type GhInstallChoice =
  | { kind: 'agent'; agent: GhAgent }
  | { kind: 'dir'; dir: '.agents/skills' };

async function pickGhInstallChoice(): Promise<GhInstallChoice | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Claude Code',    description: 'Installs to .claude/skills/',   detail: '--agent claude-code',     value: { kind: 'agent', agent: 'claude-code' as GhAgent } },
      { label: 'GitHub Copilot', description: 'Installs to .agents/skills/ (gh 2.91+) or .github/skills/ (older gh)', detail: '--agent github-copilot', value: { kind: 'agent', agent: 'github-copilot' as GhAgent } },
      {
        label: 'Cross-client',
        description: '.agents/skills/  — works on any agentskills.io-compatible host',
        detail: '--dir .agents/skills (single install serves both Claude Code and Copilot)',
        value: { kind: 'dir', dir: '.agents/skills' as const },
      },
    ],
    { placeHolder: 'Select install location' },
  );
  return choice?.value as GhInstallChoice | undefined;
}

async function pickSkills(): Promise<FrameworkSkill[] | undefined> {
  const items = FRAMEWORK_SKILLS.map(name => ({
    label: name,
    description: SKILL_DESCRIPTIONS[name],
    picked: true,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select skills to install (all selected by default)',
    canPickMany: true,
  });
  if (!picked) return undefined;
  if (picked.length === 0) {
    vscode.window.showInformationMessage('No skills selected — nothing to install.');
    return undefined;
  }
  return picked.map(p => p.label as FrameworkSkill);
}

async function pickVersion(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt: 'Canopy version to install (semver, no leading "v"). Leave empty for latest release.',
    placeHolder: '0.17.0',
    validateInput: v => v === '' || /^\d+\.\d+\.\d+/.test(v) ? undefined : 'Must be empty or semver (X.Y.Z)',
  });
  // showInputBox returns undefined when user cancels, '' when they submit empty.
  return value;
}

// ---------------------------------------------------------------------------
// Command: Install (unified entry point — picks method based on availability)
// ---------------------------------------------------------------------------

export async function install(): Promise<void> {
  const tools = await detectTools();
  const items = buildInstallMethodPicks(tools);
  const picked = await vscode.window.showQuickPick(
    items.map(item => ({
      label: item.label,
      description: item.description,
      detail: item.detail,
      method: item.method,
    })),
    { placeHolder: 'Pick an install method (icons reflect tool availability)' },
  );
  if (!picked) return;

  switch (picked.method) {
    case 'install-script':
      return installByCopy();
    case 'gh-skill':
      return installAsAgentSkill();
    case 'plugin':
      return installAsPlugin();
  }
}

// ---------------------------------------------------------------------------
// Command: Install (via install script) — clone + run install.sh / install.ps1
// ---------------------------------------------------------------------------

export async function installByCopy(): Promise<void> {
  if (!(await isCommandAvailable('git'))) {
    const choice = await vscode.window.showErrorMessage(
      'git is required for the install-script method (it clones canopy from GitHub). ' +
      'Install git, or use the gh-skill method instead.',
      'Use gh skill install',
      'Open git download',
      'Cancel',
    );
    if (choice === 'Use gh skill install') return installAsAgentSkill();
    if (choice === 'Open git download') {
      vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/downloads'));
    }
    return;
  }

  const folder = await pickWorkspaceFolder();
  if (!folder) return;
  const target = await pickTarget();
  if (!target) return;
  const skills = await pickSkills();
  if (!skills) return;
  const version = await pickVersion();
  if (version === undefined) return;

  const root = folder.uri.fsPath;
  const url = canopyUrl();
  const versionLabel = version || 'latest';

  const out = getOutput();
  out.show(true);
  log(`\nInstall via install script — target=${target}, skills=${skills.join(',')}, version=${versionLabel}`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing Canopy (${target})…`,
      cancellable: false,
    },
    async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-install-'));
      try {
        const branchArg = version ? ` --branch v${version}` : '';
        log(`Cloning canopy${version ? ` v${version}` : ' (master)'} to ${tmpDir}…`);
        await execAsync(`git clone --depth=1 --quiet${branchArg} "${url}" "${tmpDir}"`);

        const isWindows = process.platform === 'win32';
        const scriptPath = path.join(tmpDir, isWindows ? 'install.ps1' : 'install.sh');
        const cmd = buildInstallScriptCommand(scriptPath, target, version || undefined, isWindows);
        log(`Running: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd, { cwd: root });
        if (stdout) log(stdout.trim());
        if (stderr) log(stderr.trim());

        // Remove unchecked skills (install script always installs all three)
        const checked = new Set(skills);
        const baseSkills = path.join(targetBaseDir(root, target), 'skills');
        for (const skill of FRAMEWORK_SKILLS) {
          if (checked.has(skill)) continue;
          const dir = path.join(baseSkills, skill);
          if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            log(`  removed   skills/${skill}/  (unchecked)`);
          }
        }

        log('\nDone.');
        vscode.window.showInformationMessage(
          `Canopy installed (${target}, ${skills.join(', ')}).`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`\nError: ${msg}`);
        vscode.window.showErrorMessage(`Canopy install failed: ${msg}`);
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Command: Install as Agent Skill (gh skill install per skill)
// ---------------------------------------------------------------------------

export async function installAsAgentSkill(): Promise<void> {
  if (!(await isCommandAvailable('gh'))) {
    const choice = await vscode.window.showErrorMessage(
      'GitHub CLI v2.90.0+ with the `skill` subcommand is required for the gh-skill method. ' +
      'Install or upgrade gh from cli.github.com, or use the install-script method instead.',
      'Use install script',
      'Open gh download',
      'Cancel',
    );
    if (choice === 'Use install script') return installByCopy();
    if (choice === 'Open gh download') {
      vscode.env.openExternal(vscode.Uri.parse('https://cli.github.com/'));
    }
    return;
  }

  const folder = await pickWorkspaceFolder();
  if (!folder) return;
  const choice = await pickGhInstallChoice();
  if (!choice) return;
  const skills = await pickSkills();
  if (!skills) return;
  const version = await pickVersion();
  if (version === undefined) return;

  const root = folder.uri.fsPath;
  const repo = canopyRepo();
  const versionLabel = version || 'master';
  const choiceLabel = choice.kind === 'agent' ? choice.agent : `cross-client (${choice.dir})`;

  const out = getOutput();
  out.show(true);
  log(`\nInstall via gh skill — ${choiceLabel}, skills=${skills.join(',')}, version=${versionLabel}`);

  // Resolve where to write the ambient marker block. Cross-client installs may
  // write to multiple files (whichever instructions file the active host reads).
  const ambientFiles: string[] = choice.kind === 'agent'
    ? [ambientInstructionFile(root, choice.agent)]
    : crossClientAmbientFiles(root, fs.existsSync);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing Canopy as Agent Skill (${choiceLabel})…`,
      cancellable: false,
    },
    async () => {
      try {
        for (const skill of skills) {
          const cmd = buildGhSkillCommand(repo, skill, choice, version || undefined);
          log(`Running: ${cmd}`);
          const { stdout, stderr } = await execAsync(cmd, { cwd: root });
          if (stdout) log(stdout.trim());
          if (stderr) log(stderr.trim());
        }

        // gh skill install does NOT write ambient instruction files. Do it ourselves
        // so canopy-runtime is auto-loaded by the active host.
        for (const ambientFile of ambientFiles) {
          const result = writeAmbientMarkerBlock(ambientFile);
          switch (result.kind) {
          case 'created':
            log(`Wrote canopy-runtime marker block to new file: ${path.relative(root, ambientFile)}`);
            break;
          case 'appended':
            log(`Appended canopy-runtime marker block to: ${path.relative(root, ambientFile)}`);
            break;
          case 'replaced':
            log(`Replaced canopy-runtime marker block in: ${path.relative(root, ambientFile)}`);
            if (result.warning) log(result.warning);
            break;
          case 'unchanged':
            log(`Canopy-runtime marker block already current in: ${path.relative(root, ambientFile)}`);
            break;
          case 'malformed':
            log(
              `Could not update ${path.relative(root, ambientFile)}: malformed marker pairs ` +
              `(begin=${result.beginCount}, end=${result.endCount}). Fix manually.`,
            );
            vscode.window.showWarningMessage(
              `Canopy skills installed, but ${path.relative(root, ambientFile)} has malformed marker pairs — fix manually.`,
            );
            break;
          }
        }

        log('\nDone.');
        vscode.window.showInformationMessage(
          `Canopy installed via gh skill (${choiceLabel}, ${skills.join(', ')}).`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`\nError: ${msg}`);
        vscode.window.showErrorMessage(
          `gh skill install failed: ${msg}. Ensure the GitHub CLI ('gh') is installed and authenticated.`,
        );
      }
    },
  );
}

/** Side-effecting wrapper: read the file (if any), apply the marker block, write back. */
function writeAmbientMarkerBlock(targetFile: string): MarkerBlockResult {
  const existing = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : undefined;
  const result = applyMarkerBlock(existing);
  if (result.kind === 'malformed') {
    return { kind: 'malformed', path: targetFile, beginCount: result.beginCount!, endCount: result.endCount! };
  }
  if (result.kind === 'unchanged') {
    return { kind: 'unchanged', path: targetFile };
  }
  if (result.content !== undefined) {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, result.content, 'utf8');
  }
  if (result.kind === 'replaced' && result.warning) {
    return { kind: 'replaced', path: targetFile, warning: result.warning };
  }
  return { kind: result.kind, path: targetFile } as MarkerBlockResult;
}

// ---------------------------------------------------------------------------
// Command: Install as Plugin (Claude Code only — slash commands to clipboard)
// ---------------------------------------------------------------------------

export async function installAsPlugin(): Promise<void> {
  // Show skill checkboxes for UX consistency. Plugin install bundles all three
  // skills together — there is no per-skill plugin marketplace — so unchecking
  // is informational. Warn if the user unchecks.
  const skills = await pickSkills();
  if (!skills) return;
  if (skills.length !== FRAMEWORK_SKILLS.length) {
    const proceed = await vscode.window.showWarningMessage(
      'Plugin install bundles all three Canopy skills together — there is no per-skill ' +
      'plugin marketplace. The /plugin install command will install canopy + canopy-runtime + canopy-debug ' +
      'as one bundle regardless of selection here. Continue?',
      { modal: true },
      'Continue (install all 3)',
      'Cancel',
    );
    if (proceed !== 'Continue (install all 3)') return;
  }

  const repo = canopyRepo();
  const cmds = pluginInstallSlashCommands(repo);

  const stepLabels = [
    'Register the Canopy marketplace',
    'Install the Canopy plugin bundle',
    'Activate canopy-runtime in this project',
  ];
  const stepNotes = [
    '',
    '',
    'This writes the canopy-runtime marker block to CLAUDE.md so skills under .claude/skills/ load runtime ambiently.',
  ];

  for (let i = 0; i < cmds.length; i++) {
    await vscode.env.clipboard.writeText(cmds[i]);
    const isLast = i === cmds.length - 1;
    const choice = await vscode.window.showInformationMessage(
      `Canopy plugin install — step ${i + 1} of ${cmds.length}: ${stepLabels[i]}\n\n` +
      `Copied to clipboard:\n\n  ${cmds[i]}\n\n` +
      `Open a Claude Code session (or switch to one already running), paste with Ctrl+V / ⌘V, ` +
      `and wait for it to complete.` +
      (stepNotes[i] ? `\n\n${stepNotes[i]}` : ''),
      { modal: true },
      isLast ? 'Done' : 'Next →',
      'Cancel',
    );
    if (choice !== (isLast ? 'Done' : 'Next →')) return;
  }
}
