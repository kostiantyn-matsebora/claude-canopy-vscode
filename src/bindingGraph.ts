// S3 (v0.22.0+): binding graph builder.
//
// Walks a parsed skill tree and builds a graph of dataflow edges from
// `producer >> ctx.foo` to `consumer << ctx.foo`. Each edge is a typed
// flow: the producer's output schema describes what `ctx.foo` is; the
// consumer's input schema describes what the consumer expects. The
// graph is the foundation for static type-flow diagnostics
// (`diagnosticsProvider.checkContractFlow`) and binding-flow hovers
// (`hoverProvider.bindingFlow`).
//
// Binding key normalization:
//   - `>> ctx.foo` and `>> foo` are treated as the same key `foo`
//     (the `ctx.` prefix is convention; the runtime stores both as the
//     same binding name)
//   - Multiple producers of the same key — the latest (lexically last
//     before the consumer) wins, mirroring sequential tree execution
//   - Bindings that look like expressions (contain operators, dots beyond
//     `ctx.`, quotes, spaces) are skipped — only identifier-shaped names
//     participate in the typed graph.

import { ParsedSkillDocument, TreeNode } from './canopyDocument';

export interface Binding {
  /** Normalized binding name, e.g. "context" or "findings" (no `ctx.` prefix). */
  key: string;
  /** Op name that emitted this binding. */
  producerOp: string;
  /** Tree node that emitted it. */
  producerNode: TreeNode;
}

export interface BindingConsumer {
  /** Normalized binding name being consumed. */
  key: string;
  /** Op name doing the consuming. */
  consumerOp: string;
  /** Tree node consuming it. */
  consumerNode: TreeNode;
}

export interface BindingEdge {
  producer: Binding;
  consumer: BindingConsumer;
}

export interface BindingGraph {
  /** All producer bindings, in tree order. */
  producers: Binding[];
  /** All consumer references, in tree order. */
  consumers: BindingConsumer[];
  /** Resolved edges: each consumer matched to its most-recent upstream producer. */
  edges: BindingEdge[];
  /** Consumer references that found no upstream producer (dangling). */
  unresolved: BindingConsumer[];
}

/**
 * Strip `ctx.` or `context.` prefix and trim. Reject expression-shaped tokens.
 * Returns the normalized identifier or undefined if the token isn't an
 * identifier (e.g. `"security"`, `findings.length`, `42`).
 *
 * Both `ctx.foo` and `context.foo` are recognized — they're conventions, not
 * runtime-distinguished namespaces.
 */
export function normalizeBindingKey(token: string): string | undefined {
  const t = token.trim().replace(/^(?:ctx|context)\./, '');
  if (!/^[a-z_][a-z0-9_]*$/i.test(t)) return undefined;
  return t;
}

/**
 * Extract identifier-shaped binding names from a `<<` or `>>` payload.
 * `|`-separated. Each part is normalized and filtered.
 *
 * Examples:
 *   "ctx.findings | file_paths"       → ["findings", "file_paths"]
 *   "\"security\" | context.file_paths" → ["file_paths"]
 *   "findings"                        → ["findings"]
 */
export function extractBindingKeys(payload: string | undefined): string[] {
  if (!payload) return [];
  const out: string[] = [];
  for (const part of payload.split('|')) {
    const k = normalizeBindingKey(part);
    if (k) out.push(k);
  }
  return out;
}

export function buildBindingGraph(parsed: ParsedSkillDocument): BindingGraph {
  const producers: Binding[] = [];
  const consumers: BindingConsumer[] = [];

  for (const node of parsed.treeNodes) {
    if (!node.opName) continue;

    // Outputs are producers.
    if (node.hasOutput) {
      for (const key of extractBindingKeys(node.output)) {
        producers.push({ key, producerOp: node.opName, producerNode: node });
      }
    }

    // Inputs are consumers — but only when the input token is an identifier
    // shape (`ctx.foo` / `foo`), not a literal expression.
    if (node.hasInput) {
      for (const key of extractBindingKeys(node.input)) {
        consumers.push({ key, consumerOp: node.opName, consumerNode: node });
      }
    }
  }

  // Resolve each consumer to the latest producer of the same key that occurs
  // strictly before it in tree order. Producers and consumers are already in
  // tree order, so we walk consumers and search backward in producers.
  const edges: BindingEdge[] = [];
  const unresolved: BindingConsumer[] = [];
  for (const c of consumers) {
    let chosen: Binding | undefined;
    for (const p of producers) {
      if (p.key !== c.key) continue;
      if (p.producerNode.line >= c.consumerNode.line) break;
      chosen = p; // latest match wins
    }
    if (chosen) {
      edges.push({ producer: chosen, consumer: c });
    } else {
      unresolved.push(c);
    }
  }

  return { producers, consumers, edges, unresolved };
}

/**
 * Find the binding edge whose consumer node is the given tree node, or whose
 * producer node is the given tree node. Used by hover to summarize bindings
 * flowing through a node.
 */
export function findEdgesAtLine(
  graph: BindingGraph,
  line: number,
): { incoming: BindingEdge[]; outgoing: BindingEdge[] } {
  const incoming: BindingEdge[] = [];
  const outgoing: BindingEdge[] = [];
  for (const e of graph.edges) {
    if (e.consumer.consumerNode.line === line) incoming.push(e);
    if (e.producer.producerNode.line === line) outgoing.push(e);
  }
  return { incoming, outgoing };
}
