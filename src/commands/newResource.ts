/**
 * Commands for creating new Canopy resource files alongside a skill.
 *
 * Each command:
 *  1. Resolves the target skill directory (from active editor or quick-pick)
 *  2. Prompts for a filename where relevant
 *  3. Writes the file with template content (never overwrites)
 *  4. Opens the created file in the editor
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** True if `dir` contains a SKILL.md or skill.md (agentskills.io spec is uppercase). */
function hasSkillFile(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'SKILL.md')) || fs.existsSync(path.join(dir, 'skill.md'));
}

// ---------------------------------------------------------------------------
// Template content
// ---------------------------------------------------------------------------

const SKILL_MD_TEMPLATE = (name: string) => `---
name: ${name}
description: One-line description.
compatibility: Requires the canopy-runtime skill (published at github.com/kostiantyn-matsebora/claude-canopy). Install with any agentskills.io-compatible tool — e.g. \`gh skill install\`, \`git clone\`, the repo's \`install.sh\`/\`install.ps1\`, or the Claude Code plugin marketplace. Supports Claude Code and GitHub Copilot.
metadata:
  argument-hint: "<required-arg>"
---

> **Runtime required.** This skill uses Canopy tree notation; canopy-runtime must be active.
>
> **Detect canopy-runtime** — present if either:
> - \`canopy-runtime/SKILL.md\` exists under \`.claude/skills/\`, \`.github/skills/\`, or \`.agents/skills/\`, OR
> - a canopy-runtime marker block exists in \`CLAUDE.md\` or \`.github/copilot-instructions.md\`.
>
> **If neither is present** — install canopy-runtime first (see the \`compatibility\` field for the source and install options), then re-invoke this skill.
>
> Do not interpret the \`## Tree\` without canopy-runtime active.

Parse $ARGUMENTS.

---

## Tree

* ${name}
  * SHOW_PLAN >> what will change
  * ASK << Proceed? | Yes | No
  * OP_NAME << input >> output
  * VERIFY_EXPECTED << assets/verify/verify-expected.md

## Rules

- Add invariants here.

## Response: summary | details
`;

const OPS_MD_TEMPLATE = (skillName: string) => `# ${skillName} — Local Ops

---

## OP_NAME << input >> output

Description of what this op does.
`;

const VERIFY_TEMPLATE = (skillName: string) => `# Expected State — ${skillName}

## Changes applied

- [ ]
- [ ]

## No regressions

- [ ] No unexpected files modified
- [ ] No \`<token>\` placeholders remain in output files
`;

const TEMPLATE_MD_TEMPLATE = `## [<version>] - <date>

<content>
`;

const TEMPLATE_YAML_TEMPLATE = `# <name>
key: <value>
`;

const CONSTANTS_TEMPLATE = (name: string) => `# ${name}

| Name | Value | Description |
|------|-------|-------------|
| \`EXAMPLE\` | value | What this constant means |
`;

const POLICY_TEMPLATE = (name: string) => `# ${name}

## Rules

1. First rule.
2. Second rule.

## Constraints

- Do not modify X unless Y.
- Always verify Z before proceeding.
`;

const COMMANDS_PS1_TEMPLATE = `# Commands

# === SECTION_NAME ===

Description of what this section does.

\`\`\`powershell
# PowerShell commands here
\`\`\`

**Output:** description of stdout output.
`;

const COMMANDS_SH_TEMPLATE = `# Commands

# === SECTION_NAME ===

Description of what this section does.

\`\`\`bash
# Shell commands here
\`\`\`

**Output:** description of stdout output.
`;

const SCHEMA_TEMPLATE = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [],
  "properties": {
    "example_field": {
      "type": "string",
      "description": "Description of this field"
    }
  }
}
`;

const EXPLORE_SCHEMA_TEMPLATE = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [],
  "properties": {}
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the skill directory from the currently active editor.
 * Accepts skill.md, ops.md, or any file inside a skill resource subdirectory.
 */
function getActiveSkillDir(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;

  const filePath = editor.document.uri.fsPath;
  const fileName = path.basename(filePath);
  const dir = path.dirname(filePath);
  const parentDir = path.dirname(dir);
  const grandParentDir = path.dirname(parentDir);

  // Direct: SKILL.md (or legacy lowercase skill.md) at skill root
  if (fileName === 'SKILL.md' || fileName.toLowerCase() === 'skill.md') return dir;

  // Legacy flat layout: ops.md at skill root
  if (fileName.toLowerCase() === 'ops.md' && hasSkillFile(dir)) return dir;

  // One level deep: legacy flat layout (schemas/, templates/, commands/, etc.) or
  // standard layout (scripts/, references/) — sibling SKILL.md exists.
  if (hasSkillFile(parentDir)) return parentDir;

  // Two levels deep: standard layout (assets/<category>/, references/ops/).
  if (hasSkillFile(grandParentDir)) return grandParentDir;

  return undefined;
}

/**
 * Scan .claude/skills/ in every workspace folder and return all skill dirs
 * that contain a skill.md file.
 */
async function pickSkillDir(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const skillDirs: string[] = [];

  for (const folder of folders) {
    const base = path.join(folder.uri.fsPath, '.claude', 'skills');
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(base, entry.name);
      if (hasSkillFile(candidate)) {
        skillDirs.push(candidate);
      }
    }
  }

  if (skillDirs.length === 0) {
    vscode.window.showErrorMessage('No skill directories found. Open a SKILL.md file first, or set up Canopy in this workspace.');
    return undefined;
  }
  if (skillDirs.length === 1) return skillDirs[0];

  const items = skillDirs.map(d => ({
    label: path.basename(d),
    description: d,
    skillDir: d,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a skill to add the resource to',
  });
  return picked?.skillDir;
}

async function resolveSkillDir(): Promise<string | undefined> {
  return getActiveSkillDir() ?? pickSkillDir();
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

async function createAndOpen(filePath: string, content: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    const choice = await vscode.window.showWarningMessage(
      `${path.relative(process.cwd(), filePath)} already exists. Open it?`,
      'Open', 'Cancel'
    );
    if (choice === 'Open') {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    }
    return;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function newSkill(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const skillName = await vscode.window.showInputBox({
    prompt: 'Skill name (kebab-case)',
    placeHolder: 'my-skill',
    validateInput: v => /^[a-z][a-z0-9-]+$/.test(v) ? undefined : 'Must be kebab-case (e.g. my-skill)',
  });
  if (!skillName) return;

  // Pick workspace if multiple
  let workspaceRoot = folders[0].uri.fsPath;
  if (folders.length > 1) {
    const picked = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace' });
    if (!picked) return;
    workspaceRoot = picked.uri.fsPath;
  }

  const skillDir = path.join(workspaceRoot, '.claude', 'skills', skillName);

  if (hasSkillFile(skillDir)) {
    vscode.window.showErrorMessage(`Skill '${skillName}' already exists.`);
    return;
  }

  ensureDir(skillDir);
  ensureDir(path.join(skillDir, 'references'));
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL_MD_TEMPLATE(skillName), 'utf8');
  fs.writeFileSync(path.join(skillDir, 'references', 'ops.md'), OPS_MD_TEMPLATE(skillName), 'utf8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(skillDir, 'SKILL.md')));
  await vscode.window.showTextDocument(doc);
  vscode.window.showInformationMessage(`Skill '${skillName}' created.`);
}

export async function newVerifyFile(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const skillName = path.basename(skillDir);
  const defaultName = 'verify-expected';
  const input = await vscode.window.showInputBox({
    prompt: 'Verify file name (without .md)',
    value: defaultName,
  });
  if (!input) return;

  await createAndOpen(
    path.join(skillDir, 'assets', 'verify', `${input}.md`),
    VERIFY_TEMPLATE(skillName)
  );
}

export async function newTemplate(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const nameInput = await vscode.window.showInputBox({
    prompt: 'Template file name (without extension)',
    placeHolder: 'entry',
  });
  if (!nameInput) return;

  const extPick = await vscode.window.showQuickPick(
    [
      { label: '.md', description: 'Markdown template' },
      { label: '.yaml', description: 'YAML template' },
      { label: '.yaml.gotmpl', description: 'Go template (YAML)' },
    ],
    { placeHolder: 'Choose template file type' }
  );
  if (!extPick) return;

  const content = extPick.label === '.md' ? TEMPLATE_MD_TEMPLATE : TEMPLATE_YAML_TEMPLATE;
  await createAndOpen(
    path.join(skillDir, 'assets', 'templates', `${nameInput}${extPick.label}`),
    content
  );
}

export async function newConstantsFile(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const input = await vscode.window.showInputBox({
    prompt: 'Constants file name (without .md)',
    placeHolder: 'values',
  });
  if (!input) return;

  await createAndOpen(
    path.join(skillDir, 'assets', 'constants', `${input}.md`),
    CONSTANTS_TEMPLATE(input)
  );
}

export async function newPolicyFile(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const input = await vscode.window.showInputBox({
    prompt: 'Policy file name (without .md)',
    placeHolder: 'rules',
  });
  if (!input) return;

  await createAndOpen(
    path.join(skillDir, 'assets', 'policies', `${input}.md`),
    POLICY_TEMPLATE(input)
  );
}

export async function newCommandsFile(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const nameInput = await vscode.window.showInputBox({
    prompt: 'Script file name (without extension)',
    placeHolder: 'scripts',
  });
  if (!nameInput) return;

  const typePick = await vscode.window.showQuickPick(
    [
      { label: '.ps1', description: 'PowerShell' },
      { label: '.sh', description: 'Bash / Shell' },
    ],
    { placeHolder: 'Choose script type' }
  );
  if (!typePick) return;

  const content = typePick.label === '.ps1' ? COMMANDS_PS1_TEMPLATE : COMMANDS_SH_TEMPLATE;
  await createAndOpen(
    path.join(skillDir, 'scripts', `${nameInput}${typePick.label}`),
    content
  );
}

export async function newSchema(): Promise<void> {
  const skillDir = await resolveSkillDir();
  if (!skillDir) return;

  const typePick = await vscode.window.showQuickPick(
    [
      { label: 'explore-schema.json', description: 'Explore subagent output contract (used with ## Agent)' },
      { label: 'custom', description: 'Custom schema file' },
    ],
    { placeHolder: 'Schema type' }
  );
  if (!typePick) return;

  let fileName = typePick.label;
  let content = EXPLORE_SCHEMA_TEMPLATE;

  if (typePick.label === 'custom') {
    const input = await vscode.window.showInputBox({
      prompt: 'Schema file name (without .json)',
      placeHolder: 'input-schema',
    });
    if (!input) return;
    fileName = `${input}.json`;
    content = SCHEMA_TEMPLATE;
  }

  await createAndOpen(
    path.join(skillDir, 'assets', 'schemas', fileName),
    content
  );
}
