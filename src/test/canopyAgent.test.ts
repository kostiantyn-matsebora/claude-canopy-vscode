import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  buildAgentPrompt,
  buildClaudeCliCommand,
  projectTargetAt,
  findProjectUpward,
  resolveProjectFromPaths,
  detectCurrentSkill,
} from '../commands/canopyAgent';

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

  it('produces the explicit Follow-path form for Copilot (no @canopy shorthand)', () => {
    expect(buildAgentPrompt('copilot', 'improve bump-version'))
      .toBe('Follow .github/agents/canopy.md and improve bump-version');
  });

  it('trims incidental whitespace around the request', () => {
    expect(buildAgentPrompt('claude', '   validate foo   ')).toBe('/canopy validate foo');
    expect(buildAgentPrompt('copilot', '   validate foo   '))
      .toBe('Follow .github/agents/canopy.md and validate foo');
  });

  it('preserves em-dashes and punctuation inside the request', () => {
    expect(buildAgentPrompt('claude', 'modify the x skill — add a SHOW_PLAN step'))
      .toBe('/canopy modify the x skill — add a SHOW_PLAN step');
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
});

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

const MARKER = path.join('skills', 'shared', 'framework', 'ops.md');

/** Build a mock `exists` from a set of present file paths. */
function mockExists(files: string[]): (candidate: string) => boolean {
  const set = new Set(files);
  return (candidate: string) => set.has(candidate);
}

describe('projectTargetAt', () => {
  it('returns "claude" when .claude/ marker present', () => {
    const exists = mockExists([path.join(p('repo'), '.claude', MARKER)]);
    expect(projectTargetAt(p('repo'), exists)).toBe('claude');
  });

  it('returns "copilot" when only .github/ marker present', () => {
    const exists = mockExists([path.join(p('repo'), '.github', MARKER)]);
    expect(projectTargetAt(p('repo'), exists)).toBe('copilot');
  });

  it('prefers claude when both are present', () => {
    const exists = mockExists([
      path.join(p('repo'), '.claude', MARKER),
      path.join(p('repo'), '.github', MARKER),
    ]);
    expect(projectTargetAt(p('repo'), exists)).toBe('claude');
  });

  it('returns undefined when neither is present', () => {
    expect(projectTargetAt(p('repo'), () => false)).toBeUndefined();
  });
});

describe('findProjectUpward', () => {
  it('finds the project when the file is inside a nested skill dir', () => {
    const exists = mockExists([path.join(p('work', 'examples'), '.claude', MARKER)]);
    const found = findProjectUpward(p('work', 'examples', '.claude', 'skills', 'foo'), exists);
    expect(found).toEqual({ root: p('work', 'examples'), target: 'claude' });
  });

  it('finds the project when starting directly at its root', () => {
    const exists = mockExists([path.join(p('work', 'vscode'), '.github', MARKER)]);
    const found = findProjectUpward(p('work', 'vscode'), exists);
    expect(found).toEqual({ root: p('work', 'vscode'), target: 'copilot' });
  });

  it('returns undefined when no ancestor has the marker', () => {
    const found = findProjectUpward(p('work', 'elsewhere', 'deep', 'dir'), () => false);
    expect(found).toBeUndefined();
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
      path.join(examples, '.claude', 'skills', 'foo', 'skill.md'),
      [examples, vscode],
      both,
    );
    expect(got).toEqual([{ root: examples, target: 'claude' }]);
  });

  it('falls back to scanning workspace folders when hint is absent', () => {
    const got = resolveProjectFromPaths(undefined, [examples, vscode], both);
    expect(got).toHaveLength(2);
    expect(got.map(c => c.root).sort()).toEqual([examples, vscode].sort());
  });

  it('falls back when the hint is outside every project', () => {
    const onlyExamples = mockExists([path.join(examples, '.claude', MARKER)]);
    const got = resolveProjectFromPaths(
      path.join(framework, 'docs', 'README.md'),
      [examples, framework],
      onlyExamples,
    );
    expect(got).toEqual([{ root: examples, target: 'claude' }]);
  });

  it('returns [] when nothing matches', () => {
    expect(resolveProjectFromPaths(undefined, [p('a'), p('b')], () => false)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Current-skill detection
// ---------------------------------------------------------------------------

describe('detectCurrentSkill', () => {
  const root = p('work', 'examples');

  it('returns the skill name for skill.md in a project skill dir', () => {
    const file = path.join(root, '.claude', 'skills', 'bump-version', 'skill.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBe('bump-version');
  });

  it('returns the skill name for a deep resource file inside the skill dir', () => {
    const file = path.join(root, '.claude', 'skills', 'bump-version', 'policies', 'bump-rules.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBe('bump-version');
  });

  it('returns the skill name for files under .claude/canopy/skills/... (subtree)', () => {
    const file = path.join(root, '.claude', 'canopy', 'skills', 'canopy-help', 'skill.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBe('canopy-help');
  });

  it('works for Copilot projects (.github/)', () => {
    const file = path.join(root, '.github', 'skills', 'generate-readme', 'skill.md');
    expect(detectCurrentSkill(file, root, 'copilot')).toBe('generate-readme');
  });

  it('ignores files inside the shared/ pseudo-skill', () => {
    const file = path.join(root, '.claude', 'skills', 'shared', 'project', 'ops.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBeUndefined();
  });

  it('returns undefined for files outside any skills root', () => {
    const file = path.join(root, 'README.md');
    expect(detectCurrentSkill(file, root, 'claude')).toBeUndefined();
  });

  it('returns undefined when there is no active editor', () => {
    expect(detectCurrentSkill(undefined, root, 'claude')).toBeUndefined();
  });
});
