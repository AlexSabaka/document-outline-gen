import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';
import { OutlineGenerator } from '../OutlineGenerator';
import { GeneratorOptions, OutlineNode } from '../../types';
import { OutlineParseError } from '../../errors';
import { parseDocComment, DocStyle } from '../../docstrings';

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

  /** Doc-comment style used to parse leading comments into `metadata.doc`. */
  protected readonly docStyle: DocStyle = 'jsdoc';

  /** Node types to climb past when locating a definition's leading comment. */
  protected docWrapperTypes = new Set<string>(['export_statement']);

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
      let nodes = this.buildOutline(defs, content, options);
      if (options.groupOverloads) {
        nodes = this.groupOverloads(nodes);
      }
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

  /**
   * Locate and clean a definition's doc comment. Default: the contiguous run of
   * comment nodes immediately preceding the definition (or its wrapper, e.g.
   * `export_statement`). Python overrides this to read the body's first string.
   * Only called when `options.includeComments` is set.
   */
  protected extractDocstring(def: DefinitionCapture, _content: string): string | undefined {
    let anchor = def.defNode;
    while (anchor.parent && this.docWrapperTypes.has(anchor.parent.type)) {
      anchor = anchor.parent;
    }
    const comments: Parser.SyntaxNode[] = [];
    let below: Parser.SyntaxNode = anchor;
    let prev = anchor.previousSibling;
    while (prev && prev.type.includes('comment')) {
      if (below.startPosition.row - prev.endPosition.row > 1) {
        break; // a blank line means it is not a doc comment for this node
      }
      comments.unshift(prev);
      below = prev;
      prev = prev.previousSibling;
    }
    if (comments.length === 0) {
      return undefined;
    }
    return this.cleanComment(comments.map((c) => c.text).join('\n')) || undefined;
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

  private buildOutline(
    defs: DefinitionCapture[],
    content: string,
    options: GeneratorOptions,
  ): OutlineNode[] {
    const defByKey = new Map<string, DefinitionCapture>();
    for (const def of defs) {
      defByKey.set(nodeKey(def.defNode), def);
    }

    const outlineByKey = new Map<string, OutlineNode>();
    const roots: OutlineNode[] = [];

    // defs are sorted by start position, so a parent is always processed
    // before any node it contains.
    for (const def of defs) {
      const node = this.toOutlineNode(def, content, options);
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

  private toOutlineNode(
    def: DefinitionCapture,
    content: string,
    options: GeneratorOptions,
  ): OutlineNode {
    const title = def.nameNode ? def.nameNode.text : this.unnamed(def);
    const type = this.mapKindToType(def.kind, def.defNode);
    const start = def.defNode.startPosition;
    const end = def.defNode.endPosition;
    const metadata: Record<string, unknown> = { ...(this.extractMetadata(def, content) ?? {}) };

    if (options.includeComments) {
      const docstring = this.extractDocstring(def, content);
      if (docstring) {
        metadata.docstring = docstring;
        const doc = parseDocComment(this.docStyle, docstring);
        if (doc) {
          metadata.doc = doc;
        }
      }
    }

    const node = this.createNode(
      title,
      type,
      1,
      { line: start.row + 1, column: start.column + 1 },
      Object.keys(metadata).length > 0 ? metadata : undefined,
    );
    node.endLine = end.row + 1;
    node.endColumn = end.column + 1;
    node.id = this.generateId(title, type, start.row + 1);
    return node;
  }

  protected cleanComment(raw: string): string {
    return raw
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*\/\*\*?/, '') // /** or /*
          .replace(/\*\/\s*$/, '') //    */
          .replace(/^\s*\/\/\/?/, '') // // or ///
          .replace(/^\s*\*\s?/, '') //   leading * in block comments
          .trimEnd(),
      )
      .join('\n')
      .trim();
  }

  private groupOverloads(nodes: OutlineNode[]): OutlineNode[] {
    const result: OutlineNode[] = [];
    const seen = new Map<string, OutlineNode>();
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        node.children = this.groupOverloads(node.children);
      }
      if (node.type === 'function' || node.type === this.methodType) {
        const key = `${node.type}:${node.title}`;
        const existing = seen.get(key);
        if (existing) {
          existing.metadata = existing.metadata ?? {};
          const count = (existing.metadata.overloads as number) ?? 1;
          existing.metadata.overloads = count + 1;
          continue; // drop the duplicate sibling
        }
        seen.set(key, node);
      }
      result.push(node);
    }
    return result;
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
