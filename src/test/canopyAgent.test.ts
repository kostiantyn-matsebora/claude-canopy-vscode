import { describe, it, expect } from 'vitest';
import { buildAgentPrompt, buildClaudeCliCommand } from '../commands/canopyAgent';

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
