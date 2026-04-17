/**
 * Parsers for canopy resource files.
 * These are used by IntelliSense providers to offer contextual completions.
 */
import * as fs from 'fs';

/** Parse `# === SECTION_NAME ===` headers from a commands (.ps1/.sh) file. */
export function parseCommandsSections(filePath: string): string[] {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return extractCommandsSections(text);
  } catch {
    return [];
  }
}

export function extractCommandsSections(text: string): string[] {
  const sections: string[] = [];
  const re = /^#\s*===\s*(.+?)\s*===\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    sections.push(m[1].trim());
  }
  return sections;
}

/** Parse `<token>` placeholder names from a template file. */
export function parseTemplatePlaceholders(filePath: string): string[] {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return extractPlaceholders(text);
  } catch {
    return [];
  }
}

export function extractPlaceholders(text: string): string[] {
  const names = new Set<string>();
  const re = /<([a-z][a-z0-9_-]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}
