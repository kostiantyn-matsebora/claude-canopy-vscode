/**
 * Canopy setup commands:
 *  - canopy.addAsSubmodule  — git submodule add + run setup script (Claude only)
 *  - canopy.addAsCopy       — clone repo, copy only needed files; prompts for Claude or GitHub Copilot target
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type AiTarget = 'claude' | 'copilot';

/** Base directory for each AI target. */
export function targetBaseDir(root: string, target: AiTarget): string {
  return path.join(root, target === 'copilot' ? '.github' : '.claude');
}

const DEFAULT_CANOPY_URL = 'https://github.com/kostiantyn-matsebora/claude-canopy';

// Stubs written during "copy" setup (same content as setup.sh)
const PROJECT_OPS_STUB = `# Project-Wide Ops

Shared ops specific to this project. Available to all skills; not portable to other projects without adaptation.

Add an op here when:
- The same multi-step pattern appears in 2 or more skills
- The behavior is complex enough to warrant a named abstraction
- The op involves project-specific tools, APIs, or conventions

Notation: \`<<\` input source or options, \`>>\` captured output or displayed fields, \`|\` item separator.
Op definitions may use tree notation internally (same syntax as skill.md \`## Tree\`).

---
`;


// skill-resources.md for COPY mode — no submodule paths
const SKILL_RESOURCES_COPY = `---
globs: [".claude/skills/**"]
---

# Skill Resource Conventions

## Category behavior

When a skill step says \`Read <category>/<file>\`, the directory determines behavior:

| Category | File types | Behavior |
|----------|------------|----------|
| \`schemas/\` | \`.json\`, \`.md\` | Use as subagent output contract or input parameter definition |
| \`templates/\` | \`.yaml\`, \`.md\`, \`.yaml.gotmpl\` | Substitute all \`<token>\` placeholders from step context; write to target path stated in step |
| \`commands/\` | \`.ps1\`, \`.sh\` | Execute the section identified with \`for <operation>\`; capture named output values stated in step |
| \`constants/\` | \`.md\` | Load all named values into step context; reference by name in subsequent steps |
| \`checklists/\` | \`.md\` | Iterate \`- [ ]\` items as evaluation criteria during the relevant op |
| \`policies/\` | \`.md\` | Apply as active rules for the duration of the skill |
| \`verify/\` | \`.md\` | Use as expected-state checklist during the verification phase |

## Named operations

When a step or tree node contains an ALL_CAPS identifier:
1. Look up in \`<skill>/ops.md\` first (skill-local ops)
2. Fall back to \`.claude/skills/shared/project/ops.md\` (project-wide ops)
3. Fall back to \`.claude/skills/shared/framework/ops.md\` (framework primitives)

\`IF\`, \`ELSE_IF\`, \`ELSE\`, \`SWITCH\`, \`CASE\`, \`DEFAULT\`, \`FOR_EACH\`, \`BREAK\`, \`END\`, \`ASK\`, \`SHOW_PLAN\`, \`VERIFY_EXPECTED\` are primitives.

## Tree format

Execute \`## Tree\` top-to-bottom as a sequential pipeline. Two equivalent syntaxes: markdown list (\`*\`) or box-drawing (\`├──\`).

## Explore subagent

When a skill has \`## Agent\` declaring \`**explore**\`: launch an Explore subagent; use \`schemas/explore-schema.json\` as the output contract.
`;

// skill-resources.md for GitHub Copilot COPY mode — references .github/skills/**
const SKILL_RESOURCES_COPILOT = `---
globs: [".github/skills/**"]
---

# Skill Resource Conventions

## Category behavior

When a skill step says \`Read <category>/<file>\`, the directory determines behavior:

| Category | File types | Behavior |
|----------|------------|----------|
| \`schemas/\` | \`.json\`, \`.md\` | Use as subagent output contract or input parameter definition |
| \`templates/\` | \`.yaml\`, \`.md\`, \`.yaml.gotmpl\` | Substitute all \`<token>\` placeholders from step context; write to target path stated in step |
| \`commands/\` | \`.ps1\`, \`.sh\` | Execute the section identified with \`for <operation>\`; capture named output values stated in step |
| \`constants/\` | \`.md\` | Load all named values into step context; reference by name in subsequent steps |
| \`checklists/\` | \`.md\` | Iterate \`- [ ]\` items as evaluation criteria during the relevant op |
| \`policies/\` | \`.md\` | Apply as active rules for the duration of the skill |
| \`verify/\` | \`.md\` | Use as expected-state checklist during the verification phase |

## Named operations

When a step or tree node contains an ALL_CAPS identifier:
1. Look up in \`<skill>/ops.md\` first (skill-local ops)
2. Fall back to \`.github/skills/shared/project/ops.md\` (project-wide ops)
3. Fall back to \`.github/skills/shared/framework/ops.md\` (framework primitives)

\`IF\`, \`ELSE_IF\`, \`ELSE\`, \`SWITCH\`, \`CASE\`, \`DEFAULT\`, \`FOR_EACH\`, \`BREAK\`, \`END\`, \`ASK\`, \`SHOW_PLAN\`, \`VERIFY_EXPECTED\` are primitives.

## Tree format

Execute \`## Tree\` top-to-bottom as a sequential pipeline. Two equivalent syntaxes: markdown list (\`*\`) or box-drawing (\`├──\`).

## Explore subagent

When a skill has \`## Agent\` declaring \`**explore**\`: launch an Explore subagent; use \`schemas/explore-schema.json\` as the output contract.
`;

// Shared ops redirect stub content per target
function sharedOpsRedirect(target: AiTarget): string {
  const base = target === 'copilot' ? '.github' : '.claude';
  return `# Shared Ops — Redirected

- **Framework primitives** (IF, ASK, SHOW_PLAN, …) → \`${base}/skills/shared/framework/ops.md\`
- **Project-wide ops** → \`${base}/skills/shared/project/ops.md\`
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let output: vscode.OutputChannel | undefined;

function getOutput(): vscode.OutputChannel {
  if (!output) output = vscode.window.createOutputChannel('Canopy Setup');
  return output;
}

function log(msg: string): void {
  getOutput().appendLine(msg);
}

function canopyUrl(): string {
  return vscode.workspace.getConfiguration('canopy').get<string>('frameworkUrl', DEFAULT_CANOPY_URL);
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace to set up Canopy in' });
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfAbsent(filePath: string, content: string, label: string): void {
  if (fs.existsSync(filePath)) {
    log(`  exists    ${label}  (skipped)`);
  } else {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    log(`  created   ${label}`);
  }
}

function copyDirIfAbsent(src: string, dest: string, label: string): void {
  if (fs.existsSync(dest)) {
    log(`  exists    ${label}  (skipped)`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
  log(`  copied    ${label}`);
}

function copyFileIfAbsent(src: string, dest: string, label: string): void {
  if (fs.existsSync(dest)) {
    log(`  exists    ${label}  (skipped)`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  log(`  copied    ${label}`);
}

function linkIfAbsent(src: string, dest: string, label: string, type: 'dir' | 'file' | 'junction'): void {
  if (fs.existsSync(dest)) {
    log(`  exists    ${label}  (skipped)`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.symlinkSync(src, dest, type);
  log(`  linked    ${label}`);
}

// ---------------------------------------------------------------------------
// Command: Add as submodule — prompts for Claude or GitHub Copilot target
// ---------------------------------------------------------------------------

export async function addAsSubmodule(): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) return;

  const targetChoice = await vscode.window.showQuickPick(
    [
      { label: 'Claude', description: 'Submodule at .claude/canopy, run setup script', target: 'claude' as AiTarget },
      { label: 'GitHub Copilot', description: 'Submodule at .github/canopy, create junctions manually', target: 'copilot' as AiTarget },
    ],
    { placeHolder: 'Select AI target' }
  );
  if (!targetChoice) return;

  const target = targetChoice.target;
  const root = folder.uri.fsPath;
  const base = targetBaseDir(root, target);
  const submodulePath = path.join(base, 'canopy');
  const submoduleRelPath = `${path.basename(base)}/canopy`;

  if (fs.existsSync(submodulePath)) {
    vscode.window.showErrorMessage(`${submoduleRelPath} already exists in ${root}. Remove it first to re-add.`);
    return;
  }

  const url = canopyUrl();
  const out = getOutput();
  out.show(true);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Adding Canopy submodule (${path.basename(base)}/)…`, cancellable: false },
    async () => {
      try {
        log(`\nAdding Canopy as submodule`);
        log(`  url:    ${url}`);
        log(`  dest:   ${submoduleRelPath}`);
        log('');

        log('Running: git submodule add …');
        const { stdout: addOut, stderr: addErr } = await execAsync(
          `git submodule add "${url}" "${submoduleRelPath}"`,
          { cwd: root }
        );
        if (addOut) log(addOut.trim());
        if (addErr) log(addErr.trim());

        if (target === 'claude') {
          // For Claude: run the bundled setup script which creates .claude/ structure
          const isWindows = process.platform === 'win32';
          const setupCmd = isWindows
            ? `pwsh -NoProfile -ExecutionPolicy Bypass -File ".claude/canopy/setup.ps1"`
            : `bash ".claude/canopy/setup.sh"`;
          log(`\nRunning setup script…`);
          const { stdout: setupOut, stderr: setupErr } = await execAsync(setupCmd, { cwd: root });
          if (setupOut) log(setupOut.trim());
          if (setupErr) log(setupErr.trim());
        } else {
          // For Copilot: setup scripts are hardcoded to .claude/ — create junctions + stubs manually
          log('\nCreating junctions and stubs for .github/ …');
          const linkType = process.platform === 'win32' ? 'junction' : 'dir';
          const baseLabel = path.basename(base);

          // framework ops.md dir
          linkIfAbsent(
            path.join(submodulePath, 'skills', 'shared', 'framework'),
            path.join(base, 'skills', 'shared', 'framework'),
            `${baseLabel}/skills/shared/framework/`,
            linkType
          );

          // bundled skills (all non-shared skill dirs)
          const skillsSrc = path.join(submodulePath, 'skills');
          for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === 'shared') continue;
            linkIfAbsent(
              path.join(skillsSrc, entry.name),
              path.join(base, 'skills', entry.name),
              `${baseLabel}/skills/${entry.name}/`,
              linkType
            );
          }

          // agents: .md files (copy) + resource dirs (junction)
          const agentsSrc = path.join(submodulePath, 'agents');
          for (const entry of fs.readdirSync(agentsSrc, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.md')) {
              copyFileIfAbsent(
                path.join(agentsSrc, entry.name),
                path.join(base, 'agents', entry.name),
                `${baseLabel}/agents/${entry.name}`
              );
            } else if (entry.isDirectory()) {
              linkIfAbsent(
                path.join(agentsSrc, entry.name),
                path.join(base, 'agents', entry.name),
                `${baseLabel}/agents/${entry.name}/`,
                linkType
              );
            }
          }

          log('\nCreating stub files…');
          writeIfAbsent(
            path.join(base, 'skills', 'shared', 'project', 'ops.md'),
            PROJECT_OPS_STUB,
            `${baseLabel}/skills/shared/project/ops.md`
          );
          writeIfAbsent(
            path.join(base, 'skills', 'shared', 'ops.md'),
            sharedOpsRedirect(target),
            `${baseLabel}/skills/shared/ops.md`
          );
          writeIfAbsent(
            path.join(base, 'rules', 'skill-resources.md'),
            SKILL_RESOURCES_COPILOT,
            `${baseLabel}/rules/skill-resources.md`
          );
        }

        log(`\nDone. Canopy is set up as a submodule in ${submoduleRelPath}.`);
        vscode.window.showInformationMessage(`Canopy submodule added successfully (${submoduleRelPath}).`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`\nError: ${msg}`);
        vscode.window.showErrorMessage(`Canopy submodule setup failed: ${msg}`);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Command: Add as copy (no garbage) — prompts for Claude or GitHub Copilot target
// ---------------------------------------------------------------------------

export async function addAsCopy(): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) return;

  const targetChoice = await vscode.window.showQuickPick(
    [
      { label: 'Claude', description: 'Copy to .claude/ (for Claude Code CLI)', target: 'claude' as AiTarget },
      { label: 'GitHub Copilot', description: 'Copy to .github/ (for GitHub Copilot)', target: 'copilot' as AiTarget },
    ],
    { placeHolder: 'Select AI target' }
  );
  if (!targetChoice) return;

  const target = targetChoice.target;
  const root = folder.uri.fsPath;
  const base = targetBaseDir(root, target);

  if (fs.existsSync(path.join(base, 'skills', 'shared', 'framework'))) {
    const overwrite = await vscode.window.showWarningMessage(
      `Canopy framework files already exist in ${path.basename(base)}/. Re-copy and overwrite?`,
      { modal: true },
      'Overwrite',
      'Cancel'
    );
    if (overwrite !== 'Overwrite') return;
  }

  const url = canopyUrl();
  const out = getOutput();
  out.show(true);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Adding Canopy (copy → ${path.basename(base)}/)…`, cancellable: false },
    async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canopy-'));
      try {
        const baseLabel = path.basename(base);
        log(`\nAdding Canopy as copy (minimal files only)`);
        log(`  url:    ${url}`);
        log(`  target: ${baseLabel}/`);
        log(`  tmp:    ${tmpDir}`);
        log('');

        // 1. Shallow clone to temp dir
        log('Cloning (shallow)…');
        const { stdout, stderr } = await execAsync(
          `git clone --depth 1 --quiet "${url}" "${tmpDir}"`,
        );
        if (stdout) log(stdout.trim());
        if (stderr) log(stderr.trim());

        log('\nCopying framework files…');

        // 2. framework/ops.md
        copyFileIfAbsent(
          path.join(tmpDir, 'skills', 'shared', 'framework', 'ops.md'),
          path.join(base, 'skills', 'shared', 'framework', 'ops.md'),
          `${baseLabel}/skills/shared/framework/ops.md`
        );

        // 3. All bundled skill dirs (everything under skills/ except shared/)
        const skillsSrc = path.join(tmpDir, 'skills');
        for (const entry of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name === 'shared') continue;
          copyDirIfAbsent(
            path.join(skillsSrc, entry.name),
            path.join(base, 'skills', entry.name),
            `${baseLabel}/skills/${entry.name}/`
          );
        }

        // 4. Agent: canopy.md + canopy/ resource dir
        const agentsSrc = path.join(tmpDir, 'agents');
        for (const entry of fs.readdirSync(agentsSrc, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            copyFileIfAbsent(
              path.join(agentsSrc, entry.name),
              path.join(base, 'agents', entry.name),
              `${baseLabel}/agents/${entry.name}`
            );
          } else if (entry.isDirectory()) {
            copyDirIfAbsent(
              path.join(agentsSrc, entry.name),
              path.join(base, 'agents', entry.name),
              `${baseLabel}/agents/${entry.name}/`
            );
          }
        }

        log('\nCreating stub files…');

        // 5. Stubs
        const skillsResources = target === 'copilot' ? SKILL_RESOURCES_COPILOT : SKILL_RESOURCES_COPY;
        const rulesDir = target === 'copilot' ? path.join(base, 'rules') : path.join(base, 'rules');

        writeIfAbsent(
          path.join(base, 'skills', 'shared', 'project', 'ops.md'),
          PROJECT_OPS_STUB,
          `${baseLabel}/skills/shared/project/ops.md`
        );
        writeIfAbsent(
          path.join(base, 'skills', 'shared', 'ops.md'),
          sharedOpsRedirect(target),
          `${baseLabel}/skills/shared/ops.md`
        );
        writeIfAbsent(
          path.join(rulesDir, 'skill-resources.md'),
          skillsResources,
          `${baseLabel}/rules/skill-resources.md`
        );

        log(`\nDone. Canopy is ready (copied to ${baseLabel}/, no submodule).`);
        vscode.window.showInformationMessage(`Canopy files copied to ${baseLabel}/ successfully.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`\nError: ${msg}`);
        vscode.window.showErrorMessage(`Canopy copy setup failed: ${msg}`);
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
      }
    }
  );
}
