import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  parseGithubRepo,
  targetBaseDir,
  buildGhSkillCommand,
  buildInstallScriptCommand,
  pluginInstallSlashCommands,
  FRAMEWORK_SKILLS,
  MARKER_START,
  MARKER_END,
  MARKER_BLOCK,
  applyMarkerBlock,
  ambientInstructionFile,
} from '../commands/installCanopy';

// ---------------------------------------------------------------------------
// parseGithubRepo
// ---------------------------------------------------------------------------

describe('parseGithubRepo', () => {
  it('accepts owner/name shorthand', () => {
    expect(parseGithubRepo('kostiantyn-matsebora/claude-canopy'))
      .toBe('kostiantyn-matsebora/claude-canopy');
  });

  it('extracts owner/name from https GitHub URL', () => {
    expect(parseGithubRepo('https://github.com/kostiantyn-matsebora/claude-canopy'))
      .toBe('kostiantyn-matsebora/claude-canopy');
  });

  it('strips a trailing .git from https URL', () => {
    expect(parseGithubRepo('https://github.com/owner/name.git'))
      .toBe('owner/name');
  });

  it('extracts owner/name from git@github.com SSH URL', () => {
    expect(parseGithubRepo('git@github.com:owner/name.git'))
      .toBe('owner/name');
  });

  it('returns undefined for non-github URLs', () => {
    expect(parseGithubRepo('https://gitlab.com/owner/name')).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(parseGithubRepo('not a url')).toBeUndefined();
    expect(parseGithubRepo('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// targetBaseDir
// ---------------------------------------------------------------------------

describe('targetBaseDir', () => {
  it('returns .claude under the root for the claude target', () => {
    expect(targetBaseDir(path.join('repo'), 'claude')).toBe(path.join('repo', '.claude'));
  });

  it('returns .github under the root for the copilot target', () => {
    expect(targetBaseDir(path.join('repo'), 'copilot')).toBe(path.join('repo', '.github'));
  });
});

// ---------------------------------------------------------------------------
// buildGhSkillCommand
// ---------------------------------------------------------------------------

describe('buildGhSkillCommand', () => {
  const REPO = 'kostiantyn-matsebora/claude-canopy';

  it('emits a project-scope, --force gh skill install command (Claude Code)', () => {
    expect(buildGhSkillCommand(REPO, 'canopy', 'claude-code', '0.17.0'))
      .toBe(`gh skill install ${REPO} canopy --agent claude-code --scope project --pin v0.17.0 --force`);
  });

  it('emits a github-copilot agent command', () => {
    expect(buildGhSkillCommand(REPO, 'canopy-runtime', 'github-copilot', '0.17.0'))
      .toBe(`gh skill install ${REPO} canopy-runtime --agent github-copilot --scope project --pin v0.17.0 --force`);
  });

  it('omits --pin when version is undefined', () => {
    expect(buildGhSkillCommand(REPO, 'canopy-debug', 'claude-code'))
      .toBe(`gh skill install ${REPO} canopy-debug --agent claude-code --scope project --force`);
  });

  it('honours user scope when requested', () => {
    expect(buildGhSkillCommand(REPO, 'canopy', 'claude-code', '0.17.0', 'user'))
      .toBe(`gh skill install ${REPO} canopy --agent claude-code --scope user --pin v0.17.0 --force`);
  });

  it('exposes all three framework skills as valid inputs', () => {
    for (const skill of FRAMEWORK_SKILLS) {
      expect(buildGhSkillCommand(REPO, skill, 'claude-code')).toContain(skill);
    }
  });
});

// ---------------------------------------------------------------------------
// buildInstallScriptCommand
// ---------------------------------------------------------------------------

describe('buildInstallScriptCommand', () => {
  it('builds a bash command on Unix with --target and --version', () => {
    expect(buildInstallScriptCommand('/tmp/canopy/install.sh', 'claude', '0.17.0', false))
      .toBe('bash "/tmp/canopy/install.sh" --target claude --version 0.17.0');
  });

  it('omits --version when not provided (Unix)', () => {
    expect(buildInstallScriptCommand('/tmp/canopy/install.sh', 'copilot', undefined, false))
      .toBe('bash "/tmp/canopy/install.sh" --target copilot');
  });

  it('builds a pwsh command on Windows with -Target and -Version', () => {
    const got = buildInstallScriptCommand('C:/tmp/canopy/install.ps1', 'claude', '0.17.0', true);
    expect(got).toBe('pwsh -NoProfile -ExecutionPolicy Bypass -File "C:/tmp/canopy/install.ps1" -Target claude -Version 0.17.0');
  });

  it('omits -Version when not provided (Windows)', () => {
    const got = buildInstallScriptCommand('C:/tmp/canopy/install.ps1', 'copilot', undefined, true);
    expect(got).toBe('pwsh -NoProfile -ExecutionPolicy Bypass -File "C:/tmp/canopy/install.ps1" -Target copilot');
  });

  it('quotes the script path so spaces are tolerated', () => {
    const got = buildInstallScriptCommand('/path with space/install.sh', 'claude', undefined, false);
    expect(got).toContain('"/path with space/install.sh"');
  });
});

// ---------------------------------------------------------------------------
// pluginInstallSlashCommands
// ---------------------------------------------------------------------------

describe('pluginInstallSlashCommands', () => {
  it('emits the marketplace add and plugin install slash commands', () => {
    const repo = 'kostiantyn-matsebora/claude-canopy';
    expect(pluginInstallSlashCommands(repo)).toEqual([
      `/plugin marketplace add ${repo}`,
      '/plugin install canopy@claude-canopy',
    ]);
  });

  it('uses the supplied repo for the marketplace-add line', () => {
    const repo = 'fork-owner/claude-canopy';
    const cmds = pluginInstallSlashCommands(repo);
    expect(cmds[0]).toBe(`/plugin marketplace add ${repo}`);
    // Plugin name + marketplace name come from canopy's marketplace.json — independent of repo.
    expect(cmds[1]).toBe('/plugin install canopy@claude-canopy');
  });
});

// ---------------------------------------------------------------------------
// FRAMEWORK_SKILLS
// ---------------------------------------------------------------------------

describe('FRAMEWORK_SKILLS', () => {
  it('contains exactly canopy, canopy-runtime, canopy-debug', () => {
    expect([...FRAMEWORK_SKILLS].sort())
      .toEqual(['canopy', 'canopy-debug', 'canopy-runtime']);
  });
});

// ---------------------------------------------------------------------------
// ambientInstructionFile
// ---------------------------------------------------------------------------

describe('ambientInstructionFile', () => {
  it('returns CLAUDE.md at repo root for the claude-code agent', () => {
    expect(ambientInstructionFile(path.join('repo'), 'claude-code'))
      .toBe(path.join('repo', 'CLAUDE.md'));
  });

  it('returns .github/copilot-instructions.md for the github-copilot agent', () => {
    expect(ambientInstructionFile(path.join('repo'), 'github-copilot'))
      .toBe(path.join('repo', '.github', 'copilot-instructions.md'));
  });
});

// ---------------------------------------------------------------------------
// applyMarkerBlock — idempotent ambient-block transform
// ---------------------------------------------------------------------------

describe('applyMarkerBlock', () => {
  it('starts the block content with MARKER_START and ends with MARKER_END', () => {
    expect(MARKER_BLOCK.startsWith(MARKER_START)).toBe(true);
    expect(MARKER_BLOCK.endsWith(MARKER_END)).toBe(true);
  });

  it('creates a new file when none exists (returns content with trailing newline)', () => {
    const result = applyMarkerBlock(undefined);
    expect(result.kind).toBe('created');
    expect(result.content).toBe(MARKER_BLOCK + '\n');
  });

  it('treats empty file the same as no file (created/appended produces just the block)', () => {
    const result = applyMarkerBlock('');
    // Empty existing → enters the append branch with empty existing content;
    // either kind is acceptable as long as the resulting file is the block alone.
    expect(['created', 'appended']).toContain(result.kind);
    expect(result.content).toBe(MARKER_BLOCK + '\n');
  });

  it('appends to existing content with a blank-line separator (file ends with newline)', () => {
    const existing = '# My Project\n\nSome notes.\n';
    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('appended');
    expect(result.content).toBe(existing + '\n' + MARKER_BLOCK + '\n');
  });

  it('appends to existing content even when the file does not end with a newline', () => {
    const existing = '# My Project\n\nSome notes.';
    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('appended');
    expect(result.content).toBe(existing + '\n\n' + MARKER_BLOCK + '\n');
  });

  it('replaces an existing marker block in place, leaving content above and below intact', () => {
    const before = '# Project\n\nIntro paragraph.\n\n';
    const after = '\n## Other section\n\nMore content.\n';
    const oldBlock = `${MARKER_START}\nstale block content\n${MARKER_END}`;
    const existing = before + oldBlock + after;

    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('replaced');
    expect(result.content).toContain(before);
    expect(result.content).toContain(after);
    expect(result.content).toContain(MARKER_BLOCK);
    expect(result.content).not.toContain('stale block content');
  });

  it('returns unchanged when the existing block is already current', () => {
    const existing = `# Header\n\n${MARKER_BLOCK}\n`;
    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('unchanged');
  });

  it('replaces only the first marker pair when multiple are present and warns', () => {
    const pair = `${MARKER_START}\nold\n${MARKER_END}`;
    const existing = `# Project\n\n${pair}\n\nmiddle\n\n${pair}\n`;
    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('replaced');
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('marker pairs');
    // Second pair (with the same "old" body) should still be present.
    expect(result.content).toContain(`${MARKER_START}\nold\n${MARKER_END}`);
    // First "old" body should be gone — replaced by current block.
    const occurrences = (result.content!.match(/\bold\b/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('returns malformed when marker counts mismatch', () => {
    const existing = `# Project\n${MARKER_START}\nbody\n`;  // missing end marker
    const result = applyMarkerBlock(existing);
    expect(result.kind).toBe('malformed');
    expect(result.beginCount).toBe(1);
    expect(result.endCount).toBe(0);
  });

  it('treats CRLF and LF line endings consistently for marker detection', () => {
    const existing = `# Header\r\n\r\n${MARKER_START}\r\nold body\r\n${MARKER_END}\r\n`;
    const result = applyMarkerBlock(existing);
    // Marker lines split on \r?\n so they should still be recognized — replace path.
    expect(result.kind).toBe('replaced');
    expect(result.content).toContain(MARKER_BLOCK);
  });
});
