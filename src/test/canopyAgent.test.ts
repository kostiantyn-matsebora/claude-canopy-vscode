import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  buildAgentPrompt,
  buildDebugPrompt,
  buildClaudeCliCommand,
  buildClaudeCliDebugCommand,
  projectTargetAt,
  findProjectUpward,
  resolveProjectFromPaths,
  detectCurrentSkill,
  type InstallKind,
} from '../commands/canopyAgent';
import { MARKER_START } from '../commands/installCanopy';

// Platform-native path helper. Tests use `p('/work', 'examples')` so separators
// match the host OS (backslash on Windows, forward slash on POSIX).
const p = (...parts: string[]): string => path.join(path.sep, ...parts.flatMap(s => s.split(/[\\/]/).filter(Boolean)));

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

describe('buildAgentPrompt', () => {
  it('produces the /canopy slash form for Claude', () => {
    expect(buildAgentPrompt('claude', 'improve bump-version'))
      .toBe('/canopy improve bump-version');
  });

  it('produces the explicit Follow-path form for Copilot', () => {
    expect(buildAgentPrompt('copilot', 'improve bump-version'))
      .toBe('Follow .github/skills/canopy/SKILL.md and improve bump-version');
  });

  it('trims incidental whitespace around the request', () => {
    expect(buildAgentPrompt('claude', '   validate foo   ')).toBe('/canopy validate foo');
    expect(buildAgentPrompt('copilot', '   validate foo   '))
      .toBe('Follow .github/skills/canopy/SKILL.md and validate foo');
  });

  it('preserves em-dashes and punctuation inside the request', () => {
    expect(buildAgentPrompt('claude', 'modify the x skill — add a SHOW_PLAN step'))
      .toBe('/canopy modify the x skill — add a SHOW_PLAN step');
  });

  it('uses namespaced /canopy:canopy form for plugin installs', () => {
    expect(buildAgentPrompt('claude', 'improve bump-version', 'plugin'))
      .toBe('/canopy:canopy improve bump-version');
  });

  it('copilot target is unaffected by installKind', () => {
    expect(buildAgentPrompt('copilot', 'improve bump-version', 'plugin'))
      .toBe('Follow .github/skills/canopy/SKILL.md and improve bump-version');
  });
});

describe('buildClaudeCliCommand', () => {
  it('wraps the /canopy prompt in a claude CLI invocation', () => {
    expect(buildClaudeCliCommand('improve bump-version'))
      .toBe('claude "/canopy improve bump-version"');
  });

  it('escapes double quotes inside the request', () => {
    expect(buildClaudeCliCommand('create a skill that says "hi"'))
      .toBe('claude "/canopy create a skill that says \\"hi\\""');
  });

  it('uses /canopy:canopy form for plugin installs', () => {
    expect(buildClaudeCliCommand('improve bump-version', 'plugin'))
      .toBe('claude "/canopy:canopy improve bump-version"');
  });
});

describe('buildDebugPrompt', () => {
  it('produces the /canopy-debug slash form for Claude', () => {
    expect(buildDebugPrompt('claude', 'bump-version'))
      .toBe('/canopy-debug bump-version');
  });

  it('produces the explicit Follow-path form for Copilot pointing at canopy-debug skill', () => {
    expect(buildDebugPrompt('copilot', 'bump-version'))
      .toBe('Follow .github/skills/canopy-debug/SKILL.md and trace bump-version');
  });

  it('trims incidental whitespace around the skill name', () => {
    expect(buildDebugPrompt('claude', '   bump-version   '))
      .toBe('/canopy-debug bump-version');
  });

  it('uses namespaced /canopy:canopy-debug form for plugin installs', () => {
    expect(buildDebugPrompt('claude', 'bump-version', 'plugin'))
      .toBe('/canopy:canopy-debug bump-version');
  });
});

describe('buildClaudeCliDebugCommand', () => {
  it('wraps the /canopy-debug prompt in a claude CLI invocation', () => {
    expect(buildClaudeCliDebugCommand('bump-version'))
      .toBe('claude "/canopy-debug bump-version"');
  });

  it('uses /canopy:canopy-debug form for plugin installs', () => {
    expect(buildClaudeCliDebugCommand('bump-version', 'plugin'))
      .toBe('claude "/canopy:canopy-debug bump-version"');
  });
});

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

// v0.17.0 install layout: every canopy install ships canopy-runtime as the minimum.
// Its SKILL.md is the canonical project marker.
const MARKER = path.join('skills', 'canopy-runtime', 'SKILL.md');

/** Build a mock `exists` from a set of present file paths. */
function mockExists(files: string[]): (candidate: string) => boolean {
  const set = new Set(files);
  return (candidate: string) => set.has(candidate);
}

/** Build a mock `readText` from a path→content map. */
function mockReadText(files: Record<string, string>): (candidate: string) => string | undefined {
  return (candidate: string) => files[candidate];
}

describe('projectTargetAt', () => {
  it('returns claude/file when .claude/skills/canopy-runtime/SKILL.md is present', () => {
    const exists = mockExists([path.join(p('repo'), '.claude', MARKER)]);
    expect(projectTargetAt(p('repo'), exists)).toEqual({ target: 'claude', installKind: 'file' });
  });

  it('returns copilot/file when only .github/ marker is present', () => {
    const exists = mockExists([path.join(p('repo'), '.github', MARKER)]);
    expect(projectTargetAt(p('repo'), exists)).toEqual({ target: 'copilot', installKind: 'file' });
  });

  it('prefers claude when both targets are present', () => {
    const exists = mockExists([
      path.join(p('repo'), '.claude', MARKER),
      path.join(p('repo'), '.github', MARKER),
    ]);
    expect(projectTargetAt(p('repo'), exists)).toEqual({ target: 'claude', installKind: 'file' });
  });

  it('returns undefined when neither marker is present', () => {
    expect(projectTargetAt(p('repo'), () => false)).toBeUndefined();
  });

  it('returns claude/plugin when CLAUDE.md contains the canopy-runtime marker block (plugin install)', () => {
    const readText = mockReadText({ [path.join(p('repo'), 'CLAUDE.md')]: `# Project\n\n${MARKER_START}\nsome content` });
    expect(projectTargetAt(p('repo'), () => false, readText)).toEqual({ target: 'claude', installKind: 'plugin' });
  });

  it('file-based marker takes priority over CLAUDE.md marker', () => {
    const readText = mockReadText({ [path.join(p('repo'), 'CLAUDE.md')]: `${MARKER_START}` });
    const exists = mockExists([path.join(p('repo'), '.github', MARKER)]);
    expect(projectTargetAt(p('repo'), exists, readText)).toEqual({ target: 'copilot', installKind: 'file' });
  });

  it('returns undefined when CLAUDE.md exists but lacks the marker (plugin not activated)', () => {
    const readText = mockReadText({ [path.join(p('repo'), 'CLAUDE.md')]: '# My Project\n\nNo canopy here.' });
    expect(projectTargetAt(p('repo'), () => false, readText)).toBeUndefined();
  });
});

describe('findProjectUpward', () => {
  it('finds the project when the file is inside a nested skill dir', () => {
    const exists = mockExists([path.join(p('work', 'examples'), '.claude', MARKER)]);
    const found = findProjectUpward(p('work', 'examples', '.claude', 'skills', 'foo'), exists);
    expect(found).toEqual({ root: p('work', 'examples'), target: 'claude', installKind: 'file' });
  });

  it('finds the project when starting directly at its root', () => {
    const exists = mockExists([path.join(p('work', 'vscode'), '.github', MARKER)]);
    const found = findProjectUpward(p('work', 'vscode'), exists);
    expect(found).toEqual({ root: p('work', 'vscode'), target: 'copilot', installKind: 'file' });
  });

  it('returns undefined when no ancestor has the marker', () => {
    const found = findProjectUpward(p('work', 'elsewhere', 'deep', 'dir'), () => false);
    expect(found).toBeUndefined();
  });

  it('finds the project via CLAUDE.md marker when walking upward (plugin install)', () => {
    const root = p('work', 'examples');
    const readText = mockReadText({ [path.join(root, 'CLAUDE.md')]: `${MARKER_START}` });
    const found = findProjectUpward(path.join(root, 'src', 'index.ts'), () => false, readText);
    expect(found).toEqual({ root, target: 'claude', installKind: 'plugin' });
  });
});

describe('resolveProjectFromPaths', () => {
  const examples = p('work', 'examples');
  const vscode = p('work', 'vscode');
  const framework = p('work', 'framework');
  const both = mockExists([
    path.join(examples, '.claude', MARKER),
    path.join(vscode, '.claude', MARKER),
  ]);

  it('prefers the hint path and returns exactly one project', () => {
    const got = resolveProjectFromPaths(
      path.join(examples, '.claude', 'skills', 'foo', 'SKILL.md'),
      [examples, vscode],
      both,
    );
    expect(got).toEqual([{ root: examples, target: 'claude', installKind: 'file' }]);
  });

  it('falls back to scanning workspace folders when hint is absent', () => {
    const got = resolveProjectFromPaths(undefined, [examples, vscode], both);
    expect(got).toHaveLength(2);
    expect(got.map(c => c.root).sort()).toEqual([examples, vscode].sort());
    expect(got.every(c => c.installKind === 'file')).toBe(true);
  });

  it('falls back when the hint is outside every project', () => {
    const onlyExamples = mockExists([path.join(examples, '.claude', MARKER)]);
    const got = resolveProjectFromPaths(
      path.join(framework, 'docs', 'README.md'),
      [examples, framework],
      onlyExamples,
    );
    expect(got).toEqual([{ root: examples, target: 'claude', installKind: 'file' }]);
  });

  it('returns [] when nothing matches', () => {
    expect(resolveProjectFromPaths(undefined, [p('a'), p('b')], () => false)).toEqual([]);
  });

  it('detects a plugin-installed project via CLAUDE.md marker', () => {
    const readText = mockReadText({ [path.join(examples, 'CLAUDE.md')]: `${MARKER_START}` });
    const got = resolveProjectFromPaths(undefined, [examples, vscode], () => false, readText);
    expect(got).toEqual([{ root: examples, target: 'claude', installKind: 'plugin' }]);
  });

  it('detects plugin project when hinting from a file inside it', () => {
    const readText = mockReadText({ [path.join(examples, 'CLAUDE.md')]: `${MARKER_START}` });
    const got = resolveProjectFromPaths(
      path.join(examples, 'src', 'foo.ts'),
      [examples],
      () => false,
      readText,
    );
    expect(got).toEqual([{ root: examples, target: 'claude', installKind: 'plugin' }]);
  });
});

// ---------------------------------------------------------------------------
// Current-skill detection
// ---------------------------------------------------------------------------

describe('detectCurrentSkill', () => {
  const root = p('work', 'examples');

  it('returns the skill name for SKILL.md in a project skill dir', () => {
    const file = path.join(root, '.claude', 'skills', 'bump-version', 'SKILL.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBe('bump-version');
  });

  it('returns the skill name for a deep resource file inside the skill dir', () => {
    const file = path.join(root, '.claude', 'skills', 'bump-version', 'policies', 'bump-rules.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBe('bump-version');
  });

  it('works for Copilot projects (.github/)', () => {
    const file = path.join(root, '.github', 'skills', 'generate-readme', 'SKILL.md');
    expect(detectCurrentSkill(file, root, 'copilot')).toBe('generate-readme');
  });

  it('excludes framework skills (canopy, canopy-debug, canopy-runtime)', () => {
    for (const fw of ['canopy', 'canopy-debug', 'canopy-runtime']) {
      const file = path.join(root, '.claude', 'skills', fw, 'SKILL.md');
      expect(detectCurrentSkill(file, root, 'claude')).toBeUndefined();
    }
  });

  it('returns undefined for files outside any skills root', () => {
    const file = path.join(root, 'README.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBeUndefined();
  });

  it('returns undefined when there is no active editor', () => {
    expect(detectCurrentSkill(undefined, root, 'claude')).toBeUndefined();
  });
});
