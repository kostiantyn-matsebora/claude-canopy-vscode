import { describe, it, expect } from 'vitest';
import { buildInstallMethodPicks } from '../commands/installCanopy';
import { ToolAvailability } from '../availability';

const ALL: ToolAvailability = { git: true, gh: true, claude: true };
const NONE: ToolAvailability = { git: false, gh: false, claude: false };

describe('buildInstallMethodPicks', () => {
  it('returns three methods in a stable order: install-script, gh-skill, plugin', () => {
    const picks = buildInstallMethodPicks(ALL);
    expect(picks.map(p => p.method)).toEqual(['install-script', 'gh-skill', 'plugin']);
  });

  it('marks install-script available iff git is present', () => {
    expect(buildInstallMethodPicks(ALL)[0].available).toBe(true);
    expect(buildInstallMethodPicks({ ...ALL, git: false })[0].available).toBe(false);
  });

  it('marks gh-skill available iff gh is present', () => {
    expect(buildInstallMethodPicks(ALL)[1].available).toBe(true);
    expect(buildInstallMethodPicks({ ...ALL, gh: false })[1].available).toBe(false);
  });

  it('marks plugin always available (clipboard fallback works without claude CLI)', () => {
    expect(buildInstallMethodPicks(ALL)[2].available).toBe(true);
    expect(buildInstallMethodPicks(NONE)[2].available).toBe(true);
  });

  it('uses $(check) icon for available tool-required methods, $(warning) for missing', () => {
    const present = buildInstallMethodPicks(ALL);
    const missing = buildInstallMethodPicks(NONE);
    expect(present[0].label).toContain('$(check)');
    expect(missing[0].label).toContain('$(warning)');
    expect(present[1].label).toContain('$(check)');
    expect(missing[1].label).toContain('$(warning)');
  });

  it('uses $(zap) for plugin when claude is missing (plugin still works via clipboard)', () => {
    const missing = buildInstallMethodPicks(NONE);
    expect(missing[2].label).toContain('$(zap)');
    expect(missing[2].label).not.toContain('$(warning)');
  });

  it('detail copy explains the missing-tool state for blocked methods', () => {
    const missing = buildInstallMethodPicks(NONE);
    expect(missing[0].detail).toMatch(/git not found/i);
    expect(missing[1].detail).toMatch(/gh CLI not found/i);
    expect(missing[2].detail).toMatch(/clipboard/i);
  });

  it('detail copy is positive when tools are present', () => {
    const present = buildInstallMethodPicks(ALL);
    expect(present[0].detail).toMatch(/git ✓/);
    expect(present[1].detail).toMatch(/gh ✓/);
    expect(present[2].detail).toMatch(/claude ✓/);
  });
});
