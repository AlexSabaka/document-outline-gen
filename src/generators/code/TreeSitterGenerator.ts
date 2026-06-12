import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';
import { OutlineGenerator } from '../OutlineGenerator';
import { GeneratorOptions, OutlineNode } from '../../types';
import { OutlineParseError } from '../../errors';

/**
 * Unified tree-sitter outline engine.
 *
 * A language generator subclasses this, names a grammar from `tree-sitter-wasms`
 * and a `queries/<name>/outline.scm` query file, and gets structure for free.
 * The query uses the GitHub code-navigation capture convention:
 *
 *   (class_specifier name: (type_identifier) @name) @definition.class
 *
 * Every match contributes one outline node: `@definition.<kind>` marks the node
 * (its span and AST position determine nesting and line numbers) and `@name`
 * supplies the title. Parent/child nesting comes from real AST containment, not
 * indentation heuristics.
 *
 * NOTE ON VERSIONS: `web-tree-sitter` is pinned `<0.25`. The 0.25 release
 * rewrote the WASM loader (new dylink format), which cannot load the prebuilt
 * grammars shipped by `tree-sitter-wasms@0.1.x`. Upgrading the runtime requires
 * a 0.25-compatible grammar source. See TECHDEBT.md.
 */

// ---- Module-level caches (kg-gen calls generators per chunk) -----------------

let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Promise<Parser.Language>>();
const parserCache = new Map<string, Parser>();
const queryCache = new Map<string, Parser.Query>();
const querySourceCache = new Map<string, string>();

async function loadLanguage(grammar: string): Promise<Parser.Language> {
  if (!initPromise) {
    initPromise = Parser.init();
  }
  await initPromise;
  let pending = languageCache.get(grammar);
  if (!pending) {
    const wasmPath = require.resolve(`tree-sitter-wasms/out/tree-sitter-${grammar}.wasm`);
    pending = Parser.Language.load(wasmPath);
    languageCache.set(grammar, pending);
  }
  return pending;
}

function getParser(grammar: string, language: Parser.Language): Parser {
  let parser = parserCache.get(grammar);
  if (!parser) {
    parser = new Parser();
    parser.setLanguage(language);
    parserCache.set(grammar, parser);
  }
  return parser;
}

function getQuery(grammar: string, language: Parser.Language, source: string): Parser.Query {
  let query = queryCache.get(grammar);
  if (!query) {
    query = language.query(source);
    queryCache.set(grammar, query);
  }
  return query;
}

// ---- Engine ------------------------------------------------------------------

interface DefinitionCapture {
  kind: string;
  defNode: Parser.SyntaxNode;
  nameNode?: Parser.SyntaxNode;
}

const DEFINITION_PREFIX = 'definition.';

export abstract class TreeSitterGenerator extends OutlineGenerator {
  /** Grammar name as published by tree-sitter-wasms (e.g. 'cpp', 'python'). */
  protected abstract readonly grammarName: string;

  /** Function-like capture kinds that become methods inside a class-like parent. */
  protected functionKinds = new Set<string>(['function']);

  /** Capture kinds whose children functions are methods. */
  protected classLikeKinds = new Set<string>(['class', 'struct', 'interface']);

  /** Type to assign when a function is reclassified as a member. */
  protected methodType = 'method';

  /** Query subdirectory under `queries/`; defaults to the grammar name. */
  protected queryName(): string {
    return this.grammarName;
  }

  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      const language = await loadLanguage(this.grammarName);
      const parser = getParser(this.grammarName, language);
      const tree = parser.parse(content);
      const query = getQuery(this.grammarName, language, this.querySource());
      const defs = this.collectDefinitions(query, tree.rootNode);
      const nodes = this.buildOutline(defs, content);
      return this.filterByDepth(nodes, options.maxDepth);
    } catch (err) {
      const fallback = this.fallback(content, options);
      if (fallback) {
        return fallback;
      }
      if (err instanceof OutlineParseError) {
        throw err;
      }
      throw new OutlineParseError(
        `tree-sitter failed to parse ${this.grammarName}: ${(err as Error).message}`,
        options.fileName,
      );
    }
  }

  getSupportedExtensions(): string[] {
    return [];
  }

  // ---- Overridable hooks -----------------------------------------------------

  /** Map a capture kind to the OutlineNode `type`. Default: identity. */
  protected mapKindToType(kind: string, _node: Parser.SyntaxNode): string {
    return kind;
  }

  /** Per-language metadata (params, visibility, returnType, …). Default: none. */
  protected extractMetadata(
    _def: DefinitionCapture,
    _content: string,
  ): Record<string, unknown> | undefined {
    return undefined;
  }

  /** Title for an unnamed definition. */
  protected unnamed(def: DefinitionCapture): string {
    return `<${def.kind}>`;
  }

  /** Optional regex/heuristic fallback if tree-sitter is unavailable. */
  protected fallback(_content: string, _options: GeneratorOptions): OutlineNode[] | null {
    return null;
  }

  // ---- Internals -------------------------------------------------------------

  private querySource(): string {
    const name = this.queryName();
    let source = querySourceCache.get(name);
    if (source === undefined) {
      const file = path.join(__dirname, '..', '..', 'queries', name, 'outline.scm');
      source = fs.readFileSync(file, 'utf-8');
      querySourceCache.set(name, source);
    }
    return source;
  }

  private collectDefinitions(query: Parser.Query, root: Parser.SyntaxNode): DefinitionCapture[] {
    const byKey = new Map<string, DefinitionCapture>();
    for (const match of query.matches(root)) {
      let defCapture: Parser.QueryCapture | undefined;
      let nameCapture: Parser.QueryCapture | undefined;
      for (const capture of match.captures) {
        if (capture.name.startsWith(DEFINITION_PREFIX)) {
          defCapture = capture;
        } else if (capture.name === 'name') {
          nameCapture = capture;
        }
      }
      if (!defCapture) {
        continue;
      }
      const key = nodeKey(defCapture.node);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          kind: defCapture.name.slice(DEFINITION_PREFIX.length),
          defNode: defCapture.node,
          nameNode: nameCapture?.node,
        });
      } else if (nameCapture && !existing.nameNode) {
        existing.nameNode = nameCapture.node;
      }
    }
    return [...byKey.values()].sort((a, b) => a.defNode.startIndex - b.defNode.startIndex);
  }

  private buildOutline(defs: DefinitionCapture[], content: string): OutlineNode[] {
    const defByKey = new Map<string, DefinitionCapture>();
    for (const def of defs) {
      defByKey.set(nodeKey(def.defNode), def);
    }

    const outlineByKey = new Map<string, OutlineNode>();
    const roots: OutlineNode[] = [];

    // defs are sorted by start position, so a parent is always processed
    // before any node it contains.
    for (const def of defs) {
      const node = this.toOutlineNode(def, content);
      outlineByKey.set(nodeKey(def.defNode), node);

      const parentKey = this.nearestEnclosing(def.defNode, defByKey);
      if (parentKey) {
        const parent = outlineByKey.get(parentKey)!;
        const parentDef = defByKey.get(parentKey)!;
        (parent.children ||= []).push(node);
        node.depth = parent.depth + 1;
        if (this.functionKinds.has(def.kind) && this.classLikeKinds.has(parentDef.kind)) {
          node.type = this.methodType;
        }
      } else {
        node.depth = 1;
        roots.push(node);
      }
    }
    return roots;
  }

  private nearestEnclosing(
    node: Parser.SyntaxNode,
    defByKey: Map<string, DefinitionCapture>,
  ): string | undefined {
    let current = node.parent;
    while (current) {
      const key = nodeKey(current);
      if (defByKey.has(key)) {
        return key;
      }
      current = current.parent;
    }
    return undefined;
  }

  private toOutlineNode(def: DefinitionCapture, content: string): OutlineNode {
    const title = def.nameNode ? def.nameNode.text : this.unnamed(def);
    const type = this.mapKindToType(def.kind, def.defNode);
    const start = def.defNode.startPosition;
    const end = def.defNode.endPosition;
    const metadata = this.extractMetadata(def, content);

    const node = this.createNode(
      title,
      type,
      1,
      { line: start.row + 1, column: start.column + 1 },
      metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
    );
    node.endLine = end.row + 1;
    node.endColumn = end.column + 1;
    node.id = this.generateId(title, type, start.row + 1);
    return node;
  }
}

function nodeKey(node: Parser.SyntaxNode): string {
  // node.id is unique per node within a tree. Span (start:end) is NOT unique:
  // a wrapper node frequently shares its child's exact span (e.g. a Python
  // `expression_statement` and its `assignment`, or a single-statement `block`
  // and its `function_definition`), which would make a node its own ancestor.
  return String(node.id);
}

export type { DefinitionCapture };
