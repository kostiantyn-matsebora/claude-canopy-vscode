import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanopyDiagnosticsProvider } from '../providers/diagnosticsProvider';
import * as vscode from 'vscode';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(text: string, fileName = 'SKILL.md') {
  return {
    getText: () => text,
    uri: vscode.Uri.file(`/test/${fileName}`),
    languageId: 'canopy',
  } as unknown as vscode.TextDocument;
}

/**
 * Minimal valid SKILL.md wrapper around a body string. Includes compatibility
 * field + safety preamble required for canopy-flavored (## Tree) skills under
 * the agentskills.io spec (v0.18.0+).
 */
function skill(body: string) {
  return makeDoc(
    `---\nname: t\ndescription: t\ncompatibility: Requires the canopy-runtime skill (published at github.com/example/canopy). Install with any agentskills.io-compatible tool.\n---\n\n` +
    `> Safety preamble — requires canopy-runtime; halt if not installed.\n\n` +
    body
  );
}

/** Minimal ops.md document. */
function ops(body: string) {
  return makeDoc(body, 'ops.md');
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

let captured: vscode.Diagnostic[];
let provider: CanopyDiagnosticsProvider;

beforeEach(() => {
  captured = [];
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue({
    set: (_: vscode.Uri, diags: vscode.Diagnostic[]) => { captured = diags ?? []; },
    delete: vi.fn(),
    dispose: vi.fn(),
  } as any);
  provider = new CanopyDiagnosticsProvider();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const msgs = () => captured.map(d => d.message);
const hasMsg = (s: string) => msgs().some(m => m.includes(s));
const hasSeverity = (sev: vscode.DiagnosticSeverity) => captured.some(d => d.severity === sev);

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

describe('diagnostics — baseline', () => {
  it('clean skill.md produces no diagnostics', async () => {
    await provider.validate(skill('## Tree\n\n* EXPLORE >> ctx\n'));
    expect(captured).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

describe('diagnostics — frontmatter', () => {
  it('errors on missing "name" field', async () => {
    await provider.validate(makeDoc('---\ndescription: t\n---\n\n## Tree\n\n* EXPLORE >> ctx\n'));
    expect(hasMsg("'name'")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('errors on missing "description" field', async () => {
    await provider.validate(makeDoc('---\nname: t\n---\n\n## Tree\n\n* EXPLORE >> ctx\n'));
    expect(hasMsg("'description'")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('warns on empty required field value', async () => {
    await provider.validate(makeDoc('---\nname: \ndescription: t\n---\n\n## Tree\n\n* EXPLORE >> ctx\n'));
    expect(hasMsg('empty')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('warns on unknown frontmatter key', async () => {
    await provider.validate(makeDoc('---\nname: t\ndescription: t\nunknown-key: x\n---\n\n## Tree\n\n* EXPLORE >> ctx\n'));
    expect(hasMsg('unknown-key')).toBe(true);
  });

  it('flags "argument-hint" at frontmatter root (must live inside metadata per agentskills.io spec)', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\nargument-hint: <file>\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('argument-hint')).toBe(true);
    expect(hasMsg("inside 'metadata:'")).toBe(true);
  });

  it('does not warn on "argument-hint" inside metadata block', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\nmetadata:\n  argument-hint: "<file>"\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('argument-hint')).toBe(false);
  });

  it('flags "user-invocable" at frontmatter root (must live inside metadata)', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\nuser-invocable: false\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('user-invocable')).toBe(true);
  });

  it('warns when compatibility is a block-form YAML map (non-spec; must be a string)', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\ncompatibility:\n  requires:\n    - canopy-runtime\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('must be a YAML string')).toBe(true);
  });

  it('warns when compatibility uses inline-flow map shape (non-spec)', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\ncompatibility: { requires: [canopy-runtime] }\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('must be a YAML string')).toBe(true);
  });

  it('warns when canopy-flavored skill (## Tree) is missing compatibility field', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('compatibility')).toBe(true);
  });

  it('hints when canopy-flavored skill (## Tree) is missing a safety preamble mentioning canopy-runtime', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\ncompatibility: Requires the canopy-runtime skill (published at github.com/example/canopy).\n---\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n'
    ));
    expect(hasMsg('safety preamble')).toBe(true);
  });

  it('flags lowercase skill.md filename (must be uppercase SKILL.md)', async () => {
    await provider.validate(makeDoc(
      '---\nname: t\ndescription: t\ncompatibility: Requires the canopy-runtime skill (published at github.com/example/canopy).\n---\n\n' +
      '> safety preamble — requires canopy-runtime; halt if not installed.\n\n' +
      '## Tree\n\n* EXPLORE >> ctx\n',
      'skill.md'
    ));
    expect(hasMsg("'SKILL.md'")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

describe('diagnostics — structure', () => {
  it('errors when ## Tree section is missing', async () => {
    await provider.validate(makeDoc('---\nname: t\ndescription: t\n---\n\nNo tree section here.'));
    expect(hasMsg('## Tree')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('warns on a fenced language code block inside ## Tree section', async () => {
    await provider.validate(skill('## Tree\n\n```yaml\nfoo: bar\n```\n'));
    expect(hasMsg('code block')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  // Box-drawing tree syntax wraps the tree in a plain ``` fence per
  // docs/FRAMEWORK.md. Plain fences must NOT trigger the structural-content
  // warning, because the fence content IS the tree.
  it('does not warn on plain ``` fence wrapping a box-drawing tree', async () => {
    await provider.validate(skill(
      '## Tree\n\n' +
      '```\n' +
      'skill-name\n' +
      '├── EXPLORE >> ctx\n' +
      '├── IF << condition\n' +
      '│   └── do something\n' +
      '└── DEFAULT\n' +
      '```\n'
    ));
    expect(hasMsg('code block')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Agent section
// ---------------------------------------------------------------------------

describe('diagnostics — agent section', () => {
  it('warns when ## Agent is present but first tree op is not EXPLORE', async () => {
    const doc = makeDoc('---\nname: t\ndescription: t\n---\n\n## Agent\n\n**explore**\n\n## Tree\n\n* IF << cond\n');
    await provider.validate(doc);
    expect(hasMsg('first tree op must be EXPLORE')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('does not warn when ## Agent is present and EXPLORE is first tree op', async () => {
    const doc = makeDoc('---\nname: t\ndescription: t\n---\n\n## Agent\n\n**explore**\n\n## Tree\n\n* EXPLORE >> ctx\n');
    await provider.validate(doc);
    expect(msgs().some(m => m.includes('first tree op must be EXPLORE'))).toBe(false);
  });

  it('warns when ## Agent is declared but tree has no op nodes', async () => {
    const doc = makeDoc('---\nname: t\ndescription: t\n---\n\n## Agent\n\n**explore**\n\n## Tree\n\nnatural language only\n');
    await provider.validate(doc);
    expect(hasMsg('no EXPLORE node')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tree node << >> syntax
// ---------------------------------------------------------------------------

describe('diagnostics — tree node syntax', () => {
  it('warns when >> appears before <<', async () => {
    await provider.validate(skill('## Tree\n\n* IF >> out << cond\n'));
    expect(hasMsg(">>' (output) appears before")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('warns when << has no content after it', async () => {
    await provider.validate(skill('## Tree\n\n* IF <<\n'));
    expect(hasMsg("'<<' operator has no content")).toBe(true);
  });

  it('warns when >> has no content after it', async () => {
    await provider.validate(skill('## Tree\n\n* EXPLORE >>\n'));
    expect(hasMsg("'>>' operator has no content")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Primitive signatures
// ---------------------------------------------------------------------------

describe('diagnostics — primitive signatures: IF / ELSE_IF', () => {
  it('errors when IF has no << condition', async () => {
    await provider.validate(skill('## Tree\n\n* IF\n'));
    expect(hasMsg("'IF' requires a condition")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('errors when ELSE_IF has no << condition', async () => {
    await provider.validate(skill('## Tree\n\n* ELSE_IF\n'));
    expect(hasMsg("'ELSE_IF' requires a condition")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('no error when IF has a << condition', async () => {
    await provider.validate(skill('## Tree\n\n* IF << something is true\n'));
    expect(msgs().filter(m => m.includes("'IF' requires"))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: ELSE / BREAK', () => {
  it('warns when ELSE has operators', async () => {
    await provider.validate(skill('## Tree\n\n* ELSE << something\n'));
    expect(hasMsg("'ELSE' takes no operators")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('warns when BREAK has operators', async () => {
    await provider.validate(skill('## Tree\n\n* BREAK >> x\n'));
    expect(hasMsg("'BREAK' takes no operators")).toBe(true);
  });

  it('no warning when ELSE has no operators', async () => {
    await provider.validate(skill('## Tree\n\n* ELSE\n'));
    expect(msgs().filter(m => m.includes("'ELSE' takes no operators"))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: ASK', () => {
  it('errors when ASK has no << input', async () => {
    await provider.validate(skill('## Tree\n\n* ASK\n'));
    expect(hasMsg("'ASK' requires")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('warns when ASK input has no | option separator', async () => {
    await provider.validate(skill('## Tree\n\n* ASK << proceed?\n'));
    expect(hasMsg("'|'")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('no warning when ASK has pipe-separated options', async () => {
    await provider.validate(skill('## Tree\n\n* ASK << proceed? | Yes | No\n'));
    expect(msgs().filter(m => m.includes('ASK'))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: SHOW_PLAN', () => {
  it('errors when SHOW_PLAN has no >> output', async () => {
    await provider.validate(skill('## Tree\n\n* SHOW_PLAN\n'));
    expect(hasMsg("'SHOW_PLAN' requires output")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('warns when SHOW_PLAN has a << input operator', async () => {
    await provider.validate(skill('## Tree\n\n* SHOW_PLAN << x >> fields\n'));
    expect(hasMsg('does not take an input')).toBe(true);
  });

  it('no warning when SHOW_PLAN has only >> output', async () => {
    await provider.validate(skill('## Tree\n\n* SHOW_PLAN >> field1 | field2\n'));
    expect(msgs().filter(m => m.includes('SHOW_PLAN'))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: VERIFY_EXPECTED', () => {
  it('errors when VERIFY_EXPECTED has no << path', async () => {
    await provider.validate(skill('## Tree\n\n* VERIFY_EXPECTED\n'));
    expect(hasMsg("'VERIFY_EXPECTED' requires a path")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it('warns when VERIFY_EXPECTED path does not start with verify/ or assets/verify/', async () => {
    await provider.validate(skill('## Tree\n\n* VERIFY_EXPECTED << schemas/check.md\n'));
    expect(hasMsg("'assets/verify/'")).toBe(true);
  });

  it('no path warning when VERIFY_EXPECTED uses legacy verify/ prefix', async () => {
    await provider.validate(skill('## Tree\n\n* VERIFY_EXPECTED << verify/check.md\n'));
    expect(msgs().filter(m => m.includes("'assets/verify/'"))).toHaveLength(0);
  });

  it('no path warning when VERIFY_EXPECTED uses agentskills assets/verify/ prefix', async () => {
    await provider.validate(skill('## Tree\n\n* VERIFY_EXPECTED << assets/verify/check.md\n'));
    expect(msgs().filter(m => m.includes("'assets/verify/'"))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: EXPLORE', () => {
  it('warns when EXPLORE has no >> output binding', async () => {
    await provider.validate(skill('## Tree\n\n* EXPLORE\n'));
    expect(hasMsg("'EXPLORE' requires an output binding")).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('no warning when EXPLORE has >> output', async () => {
    await provider.validate(skill('## Tree\n\n* EXPLORE >> ctx\n'));
    expect(msgs().filter(m => m.includes('EXPLORE'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Primitive signatures: FOR_EACH / SWITCH / CASE / DEFAULT
// ---------------------------------------------------------------------------

describe('diagnostics — primitive signatures: FOR_EACH', () => {
  it('errors when FOR_EACH has no << input', async () => {
    await provider.validate(skill('## Tree\n\n* FOR_EACH\n'));
    expect(hasMsg("'FOR_EACH' requires an input")).toBe(true);
  });

  it('no error when FOR_EACH has << input', async () => {
    await provider.validate(skill('## Tree\n\n* FOR_EACH << item in list\n'));
    expect(msgs().filter(m => m.includes('FOR_EACH'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Primitive signatures: PARALLEL
// ---------------------------------------------------------------------------

describe('diagnostics — primitive signatures: PARALLEL', () => {
  it('errors when PARALLEL has << input', async () => {
    await provider.validate(skill('## Tree\n\n* PARALLEL << foo\n  * sub-a\n  * sub-b\n'));
    expect(hasMsg("'PARALLEL' takes no inputs or outputs")).toBe(true);
  });

  it('errors when PARALLEL has >> output', async () => {
    await provider.validate(skill('## Tree\n\n* PARALLEL >> result\n  * sub-a\n  * sub-b\n'));
    expect(hasMsg("'PARALLEL' takes no inputs or outputs")).toBe(true);
  });

  it('hints when PARALLEL has fewer than 2 children', async () => {
    await provider.validate(skill('## Tree\n\n* PARALLEL\n  * lonely-child\n'));
    expect(hasMsg('fewer than 2 children')).toBe(true);
  });

  it('hints when PARALLEL has zero children', async () => {
    await provider.validate(skill('## Tree\n\n* PARALLEL\n'));
    expect(hasMsg('fewer than 2 children')).toBe(true);
  });

  it('no error or hint when PARALLEL has ≥2 children and no input/output', async () => {
    await provider.validate(skill('## Tree\n\n* PARALLEL\n  * sub-a >> ctx_a\n  * sub-b >> ctx_b\n'));
    expect(msgs().filter(m => m.includes('PARALLEL'))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: SWITCH', () => {
  it('errors when SWITCH has no << input', async () => {
    await provider.validate(skill('## Tree\n\n* SWITCH\n'));
    expect(hasMsg("'SWITCH' requires an input")).toBe(true);
  });

  it('no error when SWITCH has << input', async () => {
    await provider.validate(skill('## Tree\n\n* SWITCH << bump_type\n'));
    expect(msgs().filter(m => m.includes('SWITCH'))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: CASE', () => {
  it('errors when CASE has no << input', async () => {
    await provider.validate(skill('## Tree\n\n* CASE\n'));
    expect(hasMsg("'CASE' requires an input")).toBe(true);
  });

  it('no error when CASE has << input', async () => {
    await provider.validate(skill('## Tree\n\n* CASE << major\n'));
    expect(msgs().filter(m => m.includes('CASE'))).toHaveLength(0);
  });
});

describe('diagnostics — primitive signatures: DEFAULT', () => {
  it('warns when DEFAULT has operators', async () => {
    await provider.validate(skill('## Tree\n\n* DEFAULT << x\n'));
    expect(hasMsg("'DEFAULT' takes no operators")).toBe(true);
  });

  it('no warning when DEFAULT has no operators', async () => {
    await provider.validate(skill('## Tree\n\n* DEFAULT\n'));
    expect(msgs().filter(m => m.includes('DEFAULT'))).toHaveLength(0);
  });
});

describe('diagnostics — ops.md redefining new primitives', () => {
  it.each(['FOR_EACH', 'SWITCH', 'CASE', 'DEFAULT', 'PARALLEL'])(
    'errors when %s is redefined in ops.md',
    async (prim) => {
      await provider.validate(ops(`## ${prim}\n\n* ${prim}\n  * some body\n`));
      expect(hasMsg('framework primitive')).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// Resource reference validation
// ---------------------------------------------------------------------------

describe('diagnostics — resource refs', () => {
  it('warns on a Read path with no category directory', async () => {
    await provider.validate(skill('## Tree\n\nRead `foo.md` for something\n'));
    expect(hasMsg('no category directory')).toBe(true);
  });

  it('warns on a Read path with an unknown category', async () => {
    await provider.validate(skill('## Tree\n\nRead `unknown/foo.md` for something\n'));
    expect(hasMsg('Unknown resource category')).toBe(true);
  });

  it('warns when a resource file does not exist', async () => {
    await provider.validate(skill('## Tree\n\nRead `schemas/foo.json` for something\n'));
    expect(hasMsg('not found')).toBe(true);
  });

  it('no warning when a resource file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await provider.validate(skill('## Tree\n\nRead `schemas/foo.json` for something\n'));
    expect(hasMsg('not found')).toBe(false);
  });

  // agentskills.io layout — `assets/<sub>/` is recognized as a valid
  // category, not flagged as 'Unknown resource category 'assets/''.
  it.each([
    'assets/constants/values.md',
    'assets/policies/rules.md',
    'assets/templates/file.md',
    'assets/schemas/shape.json',
    'assets/checklists/items.md',
    'assets/verify/check.md',
  ])('accepts agentskills "%s" path as a valid category', async (p) => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await provider.validate(skill(`## Tree\n\nRead \`${p}\` for something\n`));
    expect(hasMsg('Unknown resource category')).toBe(false);
    expect(hasMsg('no category directory')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ops.md checks
// ---------------------------------------------------------------------------

describe('diagnostics — ops.md', () => {
  it('errors when a reserved primitive is redefined', async () => {
    await provider.validate(ops('## IF << condition\nDo the IF thing.'));
    expect(hasMsg('framework primitive')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Error)).toBe(true);
  });

  it.each(['IF', 'ELSE_IF', 'ELSE', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'])(
    'errors when %s is redefined',
    async (name) => {
      await provider.validate(ops(`## ${name}\nbody`));
      expect(hasMsg('framework primitive')).toBe(true);
    },
  );

  it('warns on a duplicate op definition', async () => {
    await provider.validate(ops('## MY_OP\nfirst body\n## MY_OP\nsecond body'));
    expect(hasMsg('Duplicate op definition')).toBe(true);
    expect(hasSeverity(vscode.DiagnosticSeverity.Warning)).toBe(true);
  });

  it('warns when an op has an empty body', async () => {
    await provider.validate(ops('## MY_OP\n## OTHER_OP\nbody'));
    expect(hasMsg('empty body')).toBe(true);
  });

  it('no warning when op has a non-empty body', async () => {
    await provider.validate(ops('## MY_OP\nDo something useful.'));
    expect(hasMsg('empty body')).toBe(false);
  });

  it('clean ops.md produces no diagnostics', async () => {
    await provider.validate(ops('## MY_OP << input\nDo something useful.\n## OTHER_OP >> result\nDo another thing.'));
    expect(captured).toHaveLength(0);
  });
});
