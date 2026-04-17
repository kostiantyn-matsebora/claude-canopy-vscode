import { describe, it, expect } from 'vitest';
import { extractCommandsSections, extractPlaceholders } from '../util/resourceParser';

// ---------------------------------------------------------------------------
// extractCommandsSections
// ---------------------------------------------------------------------------

describe('extractCommandsSections', () => {
  it('extracts a single section', () => {
    expect(extractCommandsSections('# === Build ===\nsome content')).toEqual(['Build']);
  });

  it('extracts multiple sections in order', () => {
    const text = '# === Build ===\ncode\n# === Test ===\nmore\n# === Deploy ===\nend';
    expect(extractCommandsSections(text)).toEqual(['Build', 'Test', 'Deploy']);
  });

  it('returns empty array when no sections present', () => {
    expect(extractCommandsSections('# regular comment\nsome code\n$var = 1')).toEqual([]);
  });

  it('trims whitespace around section names', () => {
    expect(extractCommandsSections('#  ===  Spaced Section  ===  ')).toEqual(['Spaced Section']);
  });

  it('handles PowerShell-style section usage', () => {
    const text = '# === Initialize ===\nSet-Variable -Name "foo"\n# === Run ===\nInvoke-Something';
    expect(extractCommandsSections(text)).toEqual(['Initialize', 'Run']);
  });

  it('handles shell-style section usage', () => {
    const text = '#!/bin/bash\n# === Setup ===\necho "setup"\n# === Teardown ===\nrm -rf /tmp/out';
    expect(extractCommandsSections(text)).toEqual(['Setup', 'Teardown']);
  });

  it('does not match regular hash comments', () => {
    const text = '# This is a comment\n# Another comment\n# === Real Section ===';
    expect(extractCommandsSections(text)).toEqual(['Real Section']);
  });
});

// ---------------------------------------------------------------------------
// extractPlaceholders
// ---------------------------------------------------------------------------

describe('extractPlaceholders', () => {
  it('extracts a single placeholder', () => {
    expect(extractPlaceholders('Hello <name>')).toEqual(['name']);
  });

  it('extracts multiple unique placeholders', () => {
    const names = extractPlaceholders('<foo> and <bar> and <baz>');
    expect(names).toHaveLength(3);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
    expect(names).toContain('baz');
  });

  it('deduplicates repeated placeholders', () => {
    expect(extractPlaceholders('<token> here and <token> again')).toEqual(['token']);
  });

  it('returns empty array when no placeholders', () => {
    expect(extractPlaceholders('no placeholders here')).toEqual([]);
  });

  it('handles hyphenated placeholder names', () => {
    expect(extractPlaceholders('<my-token>')).toEqual(['my-token']);
  });

  it('handles alphanumeric placeholder names', () => {
    expect(extractPlaceholders('<token1> and <item2>')).toContain('token1');
  });

  it('handles underscored placeholder names', () => {
    expect(extractPlaceholders('<my_token>')).toEqual(['my_token']);
  });

  it('does not match uppercase placeholders (spec: must start with lowercase)', () => {
    expect(extractPlaceholders('<TOKEN>')).toEqual([]);
    expect(extractPlaceholders('<MyToken>')).toEqual([]);
  });

  it('extracts from multiline template content', () => {
    const text = 'name: <project-name>\nversion: <version>\ndescription: <description>';
    const names = extractPlaceholders(text);
    expect(names).toContain('project-name');
    expect(names).toContain('version');
    expect(names).toContain('description');
  });
});
