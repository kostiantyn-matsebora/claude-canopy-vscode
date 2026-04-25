import { describe, it, expect, vi } from 'vitest';
import {
  isCommandAvailable,
  detectTools,
  ExecRunner,
} from '../availability';

/**
 * Build a fake runner that resolves for `available` commands and rejects for everything else.
 * The runner sees the full command string (e.g. "git --version"); we match the binary prefix.
 */
function fakeRunner(available: Set<string>): ExecRunner {
  return async (command) => {
    const bin = command.split(/\s+/)[0];
    if (available.has(bin)) return { stdout: `${bin} version 1.0.0`, stderr: '' };
    throw new Error(`spawn ${bin} ENOENT`);
  };
}

describe('isCommandAvailable', () => {
  it('returns true when the runner resolves', async () => {
    const runner = fakeRunner(new Set(['git']));
    expect(await isCommandAvailable('git', runner)).toBe(true);
  });

  it('returns false when the runner rejects', async () => {
    const runner = fakeRunner(new Set());
    expect(await isCommandAvailable('git', runner)).toBe(false);
  });

  it('passes the right --version probe to the runner', async () => {
    const probed: string[] = [];
    const runner: ExecRunner = async (cmd) => {
      probed.push(cmd);
      return { stdout: '', stderr: '' };
    };
    await isCommandAvailable('gh', runner);
    expect(probed).toEqual(['gh --version']);
  });

  it('does not throw on runner error — converts to false', async () => {
    const runner: ExecRunner = async () => { throw new Error('something exploded'); };
    await expect(isCommandAvailable('claude', runner)).resolves.toBe(false);
  });
});

describe('detectTools', () => {
  it('reports all three tools as available when the runner accepts each', async () => {
    const runner = fakeRunner(new Set(['git', 'gh', 'claude']));
    const tools = await detectTools(runner);
    expect(tools).toEqual({ git: true, gh: true, claude: true });
  });

  it('reports tools as unavailable when the runner rejects them', async () => {
    const runner = fakeRunner(new Set());
    const tools = await detectTools(runner);
    expect(tools).toEqual({ git: false, gh: false, claude: false });
  });

  it('reports a mixed snapshot accurately', async () => {
    const runner = fakeRunner(new Set(['git', 'claude']));
    const tools = await detectTools(runner);
    expect(tools).toEqual({ git: true, gh: false, claude: true });
  });

  it('probes all three tools (one --version invocation each)', async () => {
    const calls: string[] = [];
    const runner: ExecRunner = async (cmd) => {
      calls.push(cmd);
      return { stdout: '', stderr: '' };
    };
    await detectTools(runner);
    expect(calls.sort()).toEqual(['claude --version', 'gh --version', 'git --version']);
  });
});
