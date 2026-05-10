// S3 (v0.22.0+): JSON Schema resolver.
//
// Loads contract schemas relative to a skill root, parses them, and exposes
// the top-level property names + a basic ref-resolution helper. Used by
// diagnosticsProvider.checkContractFlow to verify binding edges line up
// with declared shapes.
//
// Scope deliberately small for the first contract release:
//   - Top-level `properties` extraction works for plain `type: object` schemas
//   - `$ref` resolves only to other schema files in the same skill's
//     `assets/schemas/` directory (cross-skill `$ref` is out of scope)
//   - No full JSON Schema validator — that's runtime concern, not authoring

import * as fs from 'fs';
import * as path from 'path';

export interface ResolvedSchema {
  /** Absolute path to the schema file. */
  filePath: string;
  /** Parsed JSON object (the schema itself). */
  schema: Record<string, unknown>;
  /** Names of top-level `properties` if the schema is an object schema. */
  topLevelProperties: string[];
}

/**
 * Load a schema file relative to a skill root. Returns undefined on missing
 * file, parse error, or non-JSON content.
 */
export function loadSchema(skillRoot: string, relPath: string): ResolvedSchema | undefined {
  const filePath = path.join(skillRoot, relPath);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      filePath,
      schema: parsed,
      topLevelProperties: extractTopLevelProperties(parsed),
    };
  } catch {
    return undefined;
  }
}

/**
 * Extract top-level property names from a JSON Schema object. Handles:
 *   - `type: object` with `properties: { ... }`
 *   - schemas wrapping properties under `oneOf` / `anyOf` (union of shapes)
 *
 * Returns the union of property names across all variants. Returns empty
 * array for schemas that don't expose property names (e.g. pure `type: array`).
 */
export function extractTopLevelProperties(schema: Record<string, unknown>): string[] {
  const props = new Set<string>();
  collectProperties(schema, props);
  return [...props];
}

function collectProperties(schema: unknown, into: Set<string>): void {
  if (!schema || typeof schema !== 'object') return;
  const s = schema as Record<string, unknown>;
  const direct = s.properties;
  if (direct && typeof direct === 'object') {
    for (const key of Object.keys(direct)) into.add(key);
  }
  for (const composite of ['oneOf', 'anyOf', 'allOf']) {
    const arr = s[composite];
    if (Array.isArray(arr)) {
      for (const sub of arr) collectProperties(sub, into);
    }
  }
}

/**
 * Walk up from `startDir` (typically the dir of an ops file) until the
 * directory containing `SKILL.md` is found. Mirror of the helper in
 * diagnosticsProvider/definitionProvider — duplicated here to avoid a
 * cross-provider import.
 */
export function findSkillRoot(startDir: string): string | undefined {
  let current = startDir;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(current, 'SKILL.md')) ||
        fs.existsSync(path.join(current, 'skill.md'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}
