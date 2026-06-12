import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';
import { OutlineGenerator } from '../OutlineGenerator';
import { GeneratorOptions, OutlineNode } from '../../types';
import { OutlineParseError } from '../../errors';
import { parseDocComment, DocStyle } from '../../docstrings';
import { SymbolEntry, SymbolReference, SymbolKind } from '../../symbols';

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

function getQuery(cacheKey: string, language: Parser.Language, source: string): Parser.Query {
  let query = queryCache.get(cacheKey);
  if (!query) {
    query = language.query(source);
    queryCache.set(cacheKey, query);
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

/** Capture-kind → stable snake_case SymbolKind (method context handled separately). */
const KIND_MAP = new Map<string, SymbolKind>([
  ['function', 'function'],
  ['method', 'method'],
  ['constructor', 'constructor'],
  ['class', 'class'],
  ['interface', 'interface'],
  ['struct', 'struct'],
  ['enum', 'enum'],
  ['enum-value', 'enum_member'],
  ['enum-member', 'enum_member'],
  ['trait', 'trait'],
  ['type', 'type_alias'],
  ['typedef', 'type_alias'],
  ['namespace', 'namespace'],
  ['module', 'module'],
  ['mod', 'module'],
  ['package', 'module'],
  ['object', 'class'],
  ['impl', 'class'],
  ['union', 'struct'],
  ['field', 'field'],
  ['property', 'property'],
  ['interface-property', 'property'],
  ['interface-method', 'method'],
  ['const', 'constant'],
  ['constant', 'constant'],
  ['variable', 'variable'],
]);

/** Synthesize a callable signature from extracted metadata, when applicable. */
function buildSignature(meta: Record<string, unknown>): string | undefined {
  const params = meta.parameters as Array<{ name: string; type?: string }> | undefined;
  if (!params) {
    return undefined;
  }
  const inner = params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ');
  const ret = meta.returnType ? `: ${meta.returnType}` : '';
  return `(${inner})${ret}`;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"`]|['"`]$/g, '');
}

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
      const query = getQuery(`${this.grammarName}:outline`, language, this.loadQuerySource('outline')!);
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

  /**
   * Whether a definition is exported / publicly visible from its module.
   * Default: wrapped in an `export_statement` (TS/JS), or `metadata.visibility`
   * is `public` (Java/C#/PHP/Kotlin/Scala). Languages with other conventions
   * override (Python underscore, Go capitalization, Rust `pub`).
   */
  protected isExported(def: DefinitionCapture, content: string): boolean {
    for (let node: Parser.SyntaxNode | null = def.defNode; node; node = node.parent) {
      if (node.type === 'export_statement') {
        return true;
      }
      if (node.parent && !this.docWrapperTypes.has(node.parent.type)) {
        break; // left the wrapper chain without finding an export
      }
    }
    return this.extractMetadata(def, content)?.visibility === 'public';
  }

  /** Map a capture kind (+ method context) to a stable snake_case SymbolKind. */
  protected symbolKind(kind: string, isMethod: boolean): SymbolKind {
    if (isMethod) {
      return kind === 'constructor' ? 'constructor' : 'method';
    }
    return KIND_MAP.get(kind) ?? 'variable';
  }

  // ---- Symbol API ------------------------------------------------------------

  /**
   * Deterministic symbol enumeration over the same parse/query infrastructure
   * as the outline. Returns a flat symbol list (with qualified names, kinds,
   * spans, export flags and signatures) plus within-file reference edges
   * (`calls`/`imports`) when a `references.scm` exists for the language.
   */
  async extractSymbols(
    content: string,
    options: GeneratorOptions = {},
  ): Promise<{ symbols: SymbolEntry[]; references: SymbolReference[] }> {
    const language = await loadLanguage(this.grammarName);
    const parser = getParser(this.grammarName, language);
    const tree = parser.parse(content);
    const query = getQuery(`${this.grammarName}:outline`, language, this.loadQuerySource('outline')!);
    const defs = this.collectDefinitions(query, tree.rootNode);

    const defByKey = new Map<string, DefinitionCapture>();
    for (const def of defs) {
      defByKey.set(nodeKey(def.defNode), def);
    }

    const qnameByKey = new Map<string, string>();
    const symbols: SymbolEntry[] = [];
    // defs are sorted parent-before-child, so a parent's qualified name exists
    // before any node it contains is processed.
    for (const def of defs) {
      const name = def.nameNode ? def.nameNode.text : this.unnamed(def);
      const parentKey = this.nearestEnclosing(def.defNode, defByKey);
      const parentQName = parentKey ? qnameByKey.get(parentKey) : undefined;
      const qualifiedName = parentQName ? `${parentQName}.${name}` : name;
      qnameByKey.set(nodeKey(def.defNode), qualifiedName);

      const isMethod =
        !!parentKey &&
        this.functionKinds.has(def.kind) &&
        this.classLikeKinds.has(defByKey.get(parentKey)!.kind);

      const entry: SymbolEntry = {
        name,
        qualifiedName,
        kind: this.symbolKind(def.kind, isMethod),
        span: {
          startLine: def.defNode.startPosition.row + 1,
          endLine: def.defNode.endPosition.row + 1,
        },
        exported: this.isExported(def, content),
      };
      const signature = buildSignature(this.extractMetadata(def, content) ?? {});
      if (signature) {
        entry.signature = signature;
      }
      symbols.push(entry);
    }

    const references = this.collectReferences(
      language,
      tree.rootNode,
      defByKey,
      qnameByKey,
      symbols,
      options,
    );
    return { symbols, references };
  }

  private collectReferences(
    language: Parser.Language,
    root: Parser.SyntaxNode,
    defByKey: Map<string, DefinitionCapture>,
    qnameByKey: Map<string, string>,
    symbols: SymbolEntry[],
    options: GeneratorOptions,
  ): SymbolReference[] {
    const source = this.loadQuerySource('references');
    if (!source) {
      return [];
    }
    const query = getQuery(`${this.grammarName}:references`, language, source);
    const fileName = options.fileName ?? '<module>';

    // name -> qualifiedName index (shortest-seen wins, since defs are top-down).
    const byName = new Map<string, string>();
    for (const symbol of symbols) {
      if (!byName.has(symbol.name)) {
        byName.set(symbol.name, symbol.qualifiedName);
      }
    }

    const refs: SymbolReference[] = [];
    const seen = new Set<string>();
    const push = (ref: SymbolReference) => {
      const key = `${ref.kind}|${ref.from}|${ref.to}|${ref.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(ref);
      }
    };

    for (const match of query.matches(root)) {
      for (const capture of match.captures) {
        const line = capture.node.startPosition.row + 1;
        if (capture.name === 'reference.call') {
          const callee = capture.node.text;
          const fromKey = this.nearestEnclosing(capture.node, defByKey);
          const from = fromKey ? qnameByKey.get(fromKey)! : fileName;
          push({ from, to: byName.get(callee) ?? callee, kind: 'calls', line });
        } else if (capture.name === 'reference.import') {
          push({ from: fileName, to: stripQuotes(capture.node.text), kind: 'imports', line });
        }
      }
    }
    return refs;
  }

  // ---- Internals -------------------------------------------------------------

  /**
   * Load a `.scm` query for this language. `kind` is the file stem
   * (`outline` | `references`). Returns `undefined` when the file is absent
   * (e.g. languages without a references query). Cached, with a sentinel for
   * the missing case so we don't re-stat.
   */
  private loadQuerySource(kind: 'outline' | 'references'): string | undefined {
    const name = this.queryName();
    const cacheKey = `${name}/${kind}`;
    let source = querySourceCache.get(cacheKey);
    if (source === undefined) {
      const file = path.join(__dirname, '..', '..', 'queries', name, `${kind}.scm`);
      source = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
      querySourceCache.set(cacheKey, source);
    }
    return source === '' ? undefined : source;
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
