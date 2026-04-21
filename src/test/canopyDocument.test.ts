import { describe, it, expect } from 'vitest';
import {
  parseDocument,
  parseOpDefinitions,
  extractReadRefs,
  extractOpRefs,
  getOpNameAtPosition,
  isPrimitive,
} from '../canopyDocument';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(text: string, fileName = 'skill.md') {
  return {
    getText: () => text,
    uri: { fsPath: `/test/${fileName}`, scheme: 'file' },
    lineAt: (line: number) => ({ text: text.split(/\r?\n/)[line] ?? '' }),
  };
}

function makeUri(fileName = 'ops.md') {
  return { fsPath: `/test/${fileName}`, scheme: 'file' };
}

/** Wrap tree content in a minimal valid skill.md shell. */
function treeDoc(treeContent: string) {
  return makeDoc(`---\nname: test\ndescription: test\n---\n\n## Tree\n\n${treeContent}`);
}

// ---------------------------------------------------------------------------
// isPrimitive
// ---------------------------------------------------------------------------

describe('isPrimitive', () => {
  it.each(['IF', 'ELSE_IF', 'ELSE', 'SWITCH', 'CASE', 'DEFAULT', 'FOR_EACH', 'BREAK', 'END', 'ASK', 'SHOW_PLAN', 'VERIFY_EXPECTED', 'EXPLORE'])(
    'returns true for %s',
    (name) => { expect(isPrimitive(name)).toBe(true); },
  );

  it('returns false for custom op names', () => {
    expect(isPrimitive('MY_OP')).toBe(false);
    expect(isPrimitive('GET_CONFIG')).toBe(false);
    expect(isPrimitive('BUILD')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractOpRefs
// ---------------------------------------------------------------------------

describe('extractOpRefs', () => {
  it('extracts ALL_CAPS identifiers from a line', () => {
    expect(extractOpRefs('MY_OP << input')).toEqual(['MY_OP']);
  });

  it('extracts multiple ALL_CAPS words', () => {
    expect(extractOpRefs('MY_OP << FILE_PATH >> RESULT')).toEqual(['MY_OP', 'FILE_PATH', 'RESULT']);
  });

  it('returns empty for lines with no ALL_CAPS', () => {
    expect(extractOpRefs('natural language action')).toEqual([]);
  });

  it('extracts primitives', () => {
    expect(extractOpRefs('IF << condition')).toEqual(['IF']);
  });

  it('ignores single-char uppercase words (pattern requires ≥2 chars)', () => {
    expect(extractOpRefs('A single letter')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getOpNameAtPosition
// ---------------------------------------------------------------------------

describe('getOpNameAtPosition', () => {
  it('returns op name when cursor is on it', () => {
    const line = '* MY_OP << input';
    expect(getOpNameAtPosition(line, 2)).toBe('MY_OP');
    expect(getOpNameAtPosition(line, 6)).toBe('MY_OP');
  });

  it('returns undefined when cursor is not on an ALL_CAPS word', () => {
    const line = '* MY_OP << input';
    expect(getOpNameAtPosition(line, 0)).toBeUndefined();  // on '*'
    expect(getOpNameAtPosition(line, 11)).toBeUndefined(); // on 'input'
  });

  it('returns the correct word among multiple ALL_CAPS', () => {
    const line = 'MY_OP << FILE_PATH';
    expect(getOpNameAtPosition(line, 0)).toBe('MY_OP');
    expect(getOpNameAtPosition(line, 10)).toBe('FILE_PATH');
  });
});

// ---------------------------------------------------------------------------
// extractReadRefs
// ---------------------------------------------------------------------------

describe('extractReadRefs', () => {
  it('parses a basic Read reference', () => {
    // 'Read `schemas/foo.json` ...'
    //  0123456789...
    //  backtick at 5 → colStart = 6, 'schemas/foo.json' = 16 chars → colEnd = 22
    const refs = extractReadRefs(['Read `schemas/foo.json` for description']);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      line: 0,
      path: 'schemas/foo.json',
      category: 'schemas/',
      colStart: 6,
      colEnd: 22,
    });
  });

  it.each([
    ['Read `templates/foo.md` for x', 'templates/'],
    ['Read `verify/foo.md` for x', 'verify/'],
    ['Read `commands/run.sh` for x', 'commands/'],
    ['Read `constants/values.md` for x', 'constants/'],
    ['Read `policies/rules.md` for x', 'policies/'],
    ['Read `checklists/items.md` for x', 'checklists/'],
  ])('extracts category from "%s"', (line, expected) => {
    expect(extractReadRefs([line])[0].category).toBe(expected);
  });

  it('returns empty string category when no slash in path', () => {
    expect(extractReadRefs(['Read `foo.md` for x'])[0].category).toBe('');
  });

  it('handles multiple refs across different lines', () => {
    const lines = [
      'Read `schemas/a.json` for A',
      'some other line',
      'Read `templates/b.md` for B',
    ];
    const refs = extractReadRefs(lines);
    expect(refs).toHaveLength(2);
    expect(refs[0].line).toBe(0);
    expect(refs[0].path).toBe('schemas/a.json');
    expect(refs[1].line).toBe(2);
    expect(refs[1].path).toBe('templates/b.md');
  });

  it('handles multiple refs on the same line', () => {
    const refs = extractReadRefs(['Read `schemas/a.json` and Read `templates/b.md`']);
    expect(refs).toHaveLength(2);
    expect(refs[0].path).toBe('schemas/a.json');
    expect(refs[1].path).toBe('templates/b.md');
  });

  it('returns empty array when no refs present', () => {
    expect(extractReadRefs(['no references here', 'just prose'])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseOpDefinitions
// ---------------------------------------------------------------------------

describe('parseOpDefinitions', () => {
  const uri = makeUri() as any;

  it('parses a single op with signature and body', () => {
    const lines = [
      '## MY_OP << input >> output',
      'Step 1: do something.',
      'Step 2: do more.',
    ];
    const defs = parseOpDefinitions(lines, uri);
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('MY_OP');
    expect(defs[0].signature).toBe('## MY_OP << input >> output');
    expect(defs[0].startLine).toBe(0);
    expect(defs[0].endLine).toBe(2);
    expect(defs[0].bodyText).toBe('Step 1: do something.\nStep 2: do more.');
  });

  it('parses multiple ops in order', () => {
    const lines = [
      '## FIRST_OP',
      'body of first',
      '## SECOND_OP << arg',
      'body of second',
    ];
    const defs = parseOpDefinitions(lines, uri);
    expect(defs).toHaveLength(2);
    expect(defs[0].name).toBe('FIRST_OP');
    expect(defs[1].name).toBe('SECOND_OP');
  });

  it('returns empty array when no ops defined', () => {
    expect(parseOpDefinitions(['# not an op', 'some text'], uri)).toHaveLength(0);
  });

  it('parses op with empty body', () => {
    const defs = parseOpDefinitions(['## EMPTY_OP', '## NEXT_OP', 'body'], uri);
    expect(defs[0].bodyText).toBe('');
  });

  it('ignores non-op headings (lowercase or mixed case)', () => {
    const lines = ['## not-an-op', 'text', '## Section', 'text', '## MY_OP', 'body'];
    const defs = parseOpDefinitions(lines, uri);
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('MY_OP');
  });

  it('stores the source uri on each definition', () => {
    const defs = parseOpDefinitions(['## MY_OP', 'body'], uri);
    expect(defs[0].sourceUri).toBe(uri);
  });
});

// ---------------------------------------------------------------------------
// parseDocument — file type detection
// ---------------------------------------------------------------------------

describe('parseDocument — file type', () => {
  it('isSkillFile for skill.md', () => {
    const parsed = parseDocument(makeDoc('', 'skill.md') as any);
    expect(parsed.isSkillFile).toBe(true);
    expect(parsed.isOpsFile).toBe(false);
  });

  it('isOpsFile for ops.md', () => {
    const parsed = parseDocument(makeDoc('', 'ops.md') as any);
    expect(parsed.isOpsFile).toBe(true);
    expect(parsed.isSkillFile).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseDocument — frontmatter
// ---------------------------------------------------------------------------

describe('parseDocument — frontmatter', () => {
  it('parses all three frontmatter fields', () => {
    const doc = makeDoc('---\nname: my-skill\ndescription: Does things\nargument-hint: <arg>\n---\n\n## Tree\n\n');
    const { frontmatter } = parseDocument(doc as any);
    expect(frontmatter).toHaveLength(3);
    expect(frontmatter.find(f => f.key === 'name')?.value).toBe('my-skill');
    expect(frontmatter.find(f => f.key === 'description')?.value).toBe('Does things');
    expect(frontmatter.find(f => f.key === 'argument-hint')?.value).toBe('<arg>');
  });

  it('records the correct line numbers', () => {
    const doc = makeDoc('---\nname: x\ndescription: y\n---\n');
    const { frontmatter } = parseDocument(doc as any);
    expect(frontmatter.find(f => f.key === 'name')?.line).toBe(1);
    expect(frontmatter.find(f => f.key === 'description')?.line).toBe(2);
  });

  it('returns empty frontmatter when none present', () => {
    const doc = makeDoc('## Tree\n\n');
    expect(parseDocument(doc as any).frontmatter).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseDocument — sections
// ---------------------------------------------------------------------------

describe('parseDocument — sections', () => {
  it('detects ## Tree section', () => {
    const doc = makeDoc('## Tree\n\n* MY_OP\n');
    expect(parseDocument(doc as any).hasTreeSection).toBe(true);
  });

  it('detects ## Agent section', () => {
    const doc = makeDoc('## Agent\n\n**explore**\n\n## Tree\n\n* EXPLORE >> ctx\n');
    const { hasAgentSection, hasTreeSection } = parseDocument(doc as any);
    expect(hasAgentSection).toBe(true);
    expect(hasTreeSection).toBe(true);
  });

  it('hasTreeSection is false when no ## Tree', () => {
    expect(parseDocument(makeDoc('## Rules\n\n- rule\n') as any).hasTreeSection).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseDocument — tree node: op name extraction
// ---------------------------------------------------------------------------

describe('parseDocument — tree node op names', () => {
  it('extracts op name from list-style node', () => {
    const nodes = parseDocument(treeDoc('* MY_OP') as any).treeNodes;
    expect(nodes.find(n => n.opName === 'MY_OP')).toBeDefined();
  });

  it('extracts op name from box-drawing node', () => {
    const nodes = parseDocument(treeDoc('├── MY_OP') as any).treeNodes;
    expect(nodes.find(n => n.opName === 'MY_OP')).toBeDefined();
  });

  it('does NOT extract ALL_CAPS inside << binding as an op name', () => {
    const nodes = parseDocument(treeDoc('* MY_OP << FILE_PATH is set') as any).treeNodes;
    const names = nodes.map(n => n.opName).filter(Boolean);
    expect(names).toContain('MY_OP');
    expect(names).not.toContain('FILE_PATH');
  });

  it('marks framework primitives as isPrimitive', () => {
    const nodes = parseDocument(treeDoc('* IF << condition\n* ELSE\n* EXPLORE >> ctx') as any).treeNodes;
    expect(nodes.find(n => n.opName === 'IF')?.isPrimitive).toBe(true);
    expect(nodes.find(n => n.opName === 'ELSE')?.isPrimitive).toBe(true);
    expect(nodes.find(n => n.opName === 'EXPLORE')?.isPrimitive).toBe(true);
  });

  it('does not set opName for natural language nodes', () => {
    const nodes = parseDocument(treeDoc('  do something natural') as any).treeNodes;
    const nat = nodes.find(n => n.text === 'do something natural');
    expect(nat?.opName).toBeUndefined();
  });

  it('skips blank lines', () => {
    const nodes = parseDocument(treeDoc('\n\n* MY_OP\n\n') as any).treeNodes;
    expect(nodes.every(n => n.text.trim() !== '')).toBe(true);
  });

  it('sets treeFirstOpName to first ALL_CAPS node, skipping root label', () => {
    const { treeFirstOpName } = parseDocument(treeDoc('* skill-name\n  * FIRST_OP\n  * SECOND_OP') as any);
    expect(treeFirstOpName).toBe('FIRST_OP');
  });
});

// ---------------------------------------------------------------------------
// parseDocument — tree node: << >> parsing
// ---------------------------------------------------------------------------

describe('parseDocument — tree node operators', () => {
  function node(line: string) {
    const nodes = parseDocument(treeDoc(line) as any).treeNodes;
    return nodes.find(n => n.opName === 'MY_OP')!;
  }

  it('no operators', () => {
    const n = node('* MY_OP');
    expect(n.hasInput).toBe(false);
    expect(n.hasOutput).toBe(false);
    expect(n.inputOutputReversed).toBe(false);
  });

  it('<< input only', () => {
    const n = node('* MY_OP << some input data');
    expect(n.hasInput).toBe(true);
    expect(n.input).toBe('some input data');
    expect(n.hasOutput).toBe(false);
  });

  it('>> output only', () => {
    const n = node('* MY_OP >> some output');
    expect(n.hasInput).toBe(false);
    expect(n.hasOutput).toBe(true);
    expect(n.output).toBe('some output');
  });

  it('<< input >> output (both)', () => {
    const n = node('* MY_OP << the input >> the output');
    expect(n.hasInput).toBe(true);
    expect(n.input).toBe('the input');
    expect(n.hasOutput).toBe(true);
    expect(n.output).toBe('the output');
  });

  it('detects >> before << as inputOutputReversed', () => {
    const n = node('* MY_OP >> output << input');
    expect(n.inputOutputReversed).toBe(true);
  });

  it('empty << operator produces empty string input', () => {
    const n = node('* MY_OP <<');
    expect(n.hasInput).toBe(true);
    expect(n.input).toBe('');
  });

  it('empty >> operator produces empty string output', () => {
    const n = node('* MY_OP >>');
    expect(n.hasOutput).toBe(true);
    expect(n.output).toBe('');
  });

  it('box-drawing style produces same result as list style', () => {
    const list = node('* MY_OP << input >> output');
    const boxNodes = parseDocument(treeDoc('├── MY_OP << input >> output') as any).treeNodes;
    const box = boxNodes.find(n => n.opName === 'MY_OP')!;
    expect(box.hasInput).toBe(list.hasInput);
    expect(box.input).toBe(list.input);
    expect(box.hasOutput).toBe(list.hasOutput);
    expect(box.output).toBe(list.output);
  });

  it('<< with | pipe — input preserved verbatim', () => {
    const nodes = parseDocument(treeDoc('* ASK << Proceed? | Yes | No') as any).treeNodes;
    const n = nodes.find(nn => nn.opName === 'ASK')!;
    expect(n.opName).toBe('ASK');
    expect(n.input).toBe('Proceed? | Yes | No');
  });
});

// ---------------------------------------------------------------------------
// parseDocument — ops.md op definitions
// ---------------------------------------------------------------------------

describe('parseDocument — ops.md', () => {
  it('populates opDefinitions', () => {
    const doc = makeDoc('## MY_OP << input\nDo something.\n## OTHER_OP\nDo another thing.', 'ops.md');
    const { opDefinitions } = parseDocument(doc as any);
    expect(opDefinitions).toHaveLength(2);
    expect(opDefinitions.map(d => d.name)).toEqual(['MY_OP', 'OTHER_OP']);
  });

  it('does not populate opDefinitions for skill.md', () => {
    const doc = makeDoc('---\nname: x\ndescription: y\n---\n\n## Tree\n\n* MY_OP\n');
    const { opDefinitions } = parseDocument(doc as any);
    expect(opDefinitions).toHaveLength(0);
  });
});
