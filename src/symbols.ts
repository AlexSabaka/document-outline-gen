import { createHash } from 'crypto';

/**
 * Deterministic symbol/edge layer — the AST-seeded code-extraction API beside
 * the outline API. Consumers (kg-gen) enumerate definitions before the LLM pass
 * so the model augments, rather than originates, the symbol set.
 *
 * The `SymbolKind` set is deliberately small and snake_case so it folds into a
 * downstream normalized vocabulary (kg-gen's single-source-of-truth enum) with
 * zero mapping friction. `references` carry within-file resolution only —
 * cross-file resolution is the consumer's job.
 */

/** Bump when the SymbolTable shape changes incompatibly. Consumers pin this. */
export const SYMBOL_SCHEMA_VERSION = 1;

/** Stable, snake_case symbol kinds. */
export type SymbolKind =
  | 'module'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'struct'
  | 'enum'
  | 'enum_member'
  | 'trait'
  | 'type_alias'
  | 'function'
  | 'method'
  | 'constructor'
  | 'field'
  | 'property'
  | 'constant'
  | 'variable';

/** Every valid {@link SymbolKind}, for validation against the enum. */
export const SYMBOL_KINDS: readonly SymbolKind[] = [
  'module', 'namespace', 'class', 'interface', 'struct', 'enum', 'enum_member',
  'trait', 'type_alias', 'function', 'method', 'constructor', 'field',
  'property', 'constant', 'variable',
];

export interface SymbolSpan {
  startLine: number;
  endLine: number;
}

export interface SymbolEntry {
  /** Simple name as written. */
  name: string;
  /** Dotted path including enclosing definitions, e.g. `UserService.getUser`. */
  qualifiedName: string;
  kind: SymbolKind;
  span: SymbolSpan;
  /** Whether the symbol is exported / publicly visible from its module. */
  exported: boolean;
  /** Callable signature when applicable, e.g. `(id: number): Promise<User>`. */
  signature?: string;
}

export interface SymbolReference {
  /** Qualified name of the enclosing symbol (or the file at top level). */
  from: string;
  /**
   * For `calls`: the in-file qualified name when resolved, else the raw callee
   * name (left for the consumer to resolve cross-file). For `imports`: the
   * module specifier.
   */
  to: string;
  kind: 'calls' | 'imports';
  line: number;
}

export interface SymbolTable {
  schemaVersion: number;
  symbols: SymbolEntry[];
  references: SymbolReference[];
}

/** An empty table at the current schema version. */
export function emptySymbolTable(): SymbolTable {
  return { schemaVersion: SYMBOL_SCHEMA_VERSION, symbols: [], references: [] };
}

/**
 * Deterministic content hash (sha256 hex) for incremental skip — re-parsing an
 * unchanged file is a no-op when the hash matches. Built-in `crypto`, no deps.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** JSON Schema for {@link SymbolTable}, for downstream validation. */
export const SYMBOL_TABLE_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'SymbolTable',
  type: 'object',
  required: ['schemaVersion', 'symbols', 'references'],
  properties: {
    schemaVersion: { type: 'integer', const: SYMBOL_SCHEMA_VERSION },
    symbols: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'qualifiedName', 'kind', 'span', 'exported'],
        properties: {
          name: { type: 'string' },
          qualifiedName: { type: 'string' },
          kind: { type: 'string', enum: SYMBOL_KINDS as unknown as string[] },
          span: {
            type: 'object',
            required: ['startLine', 'endLine'],
            properties: {
              startLine: { type: 'integer' },
              endLine: { type: 'integer' },
            },
          },
          exported: { type: 'boolean' },
          signature: { type: 'string' },
        },
      },
    },
    references: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'kind', 'line'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          kind: { type: 'string', enum: ['calls', 'imports'] },
          line: { type: 'integer' },
        },
      },
    },
  },
} as const;
