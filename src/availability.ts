/**
 * Tool availability detection — used by install and agent commands to gate
 * choices on whether `git`, `gh`, or `claude` are reachable on PATH.
 *
 * Detection probes `<cmd> --version` with a short timeout. Subprocess failure
 * (non-zero exit, ENOENT, timeout) → unavailable. We deliberately invoke the
 * binary instead of `which`/`where` so PATH resolution matches what we'd see
 * when actually running the command.
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type Tool = 'git' | 'gh' | 'claude';

export interface ToolAvailability {
  git: boolean;
  gh: boolean;
  claude: boolean;
}

const PROBE_TIMEOUT_MS = 5_000;

/** Lightweight runner indirection so tests can substitute a fake exec. */
export type ExecRunner = (command: string) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: ExecRunner = async (command) => {
  const { stdout, stderr } = await execAsync(command, { timeout: PROBE_TIMEOUT_MS });
  return { stdout: String(stdout), stderr: String(stderr) };
};

/**
 * True if the probe command succeeds (exit 0, no spawn error, within timeout).
 *
 * For 'gh' we probe `gh skill --help` — not `gh --version` — because the
 * user-facing capability we need is the `skill` subcommand, which requires
 * GitHub CLI v2.90.0+. A binary-only check would falsely report availability
 * on older gh installs and we'd hit "unknown command 'skill'" at run time.
 */
export async function isCommandAvailable(cmd: Tool, runner: ExecRunner = defaultRunner): Promise<boolean> {
  const probe = cmd === 'gh' ? 'gh skill --help' : `${cmd} --version`;
  try {
    await runner(probe);
    return true;
  } catch {
    return false;
  }
}

/** Probe all three tools in parallel. */
export async function detectTools(runner: ExecRunner = defaultRunner): Promise<ToolAvailability> {
  const [git, gh, claude] = await Promise.all([
    isCommandAvailable('git', runner),
    isCommandAvailable('gh', runner),
    isCommandAvailable('claude', runner),
  ]);
  return { git, gh, claude };
}
