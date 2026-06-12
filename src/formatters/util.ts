import { OutlineNode } from '../types';

/** A node visited during a depth-first walk, with its ancestor titles. */
export interface WalkContext {
  node: OutlineNode;
  depth: number;
  /** Titles of the ancestors, root-first (excludes the node itself). */
  path: string[];
  /** Index assigned in pre-order (stable across a single walk). */
  index: number;
  /** Pre-order index of the parent, or -1 for roots. */
  parentIndex: number;
}

/** Pre-order DFS over an outline, yielding each node with positional context. */
export function walk(nodes: OutlineNode[], visit: (ctx: WalkContext) => void): void {
  let index = 0;
  const recurse = (list: OutlineNode[], depth: number, path: string[], parentIndex: number) => {
    for (const node of list) {
      const myIndex = index++;
      visit({ node, depth, path, index: myIndex, parentIndex });
      if (node.children && node.children.length > 0) {
        recurse(node.children, depth + 1, [...path, node.title], myIndex);
      }
    }
  };
  recurse(nodes, 1, [], -1);
}

/** Projection used by the structured exports: meaningful fields, no empties. */
export interface ExportNode {
  title: string;
  type: string;
  depth: number;
  line?: number;
  metadata?: Record<string, unknown>;
  children?: ExportNode[];
}

export function pruneForExport(nodes: OutlineNode[]): ExportNode[] {
  return nodes.map((n) => {
    const out: ExportNode = { title: n.title, type: n.type, depth: n.depth };
    if (n.line !== undefined) {
      out.line = n.line;
    }
    if (n.metadata && Object.keys(n.metadata).length > 0) {
      out.metadata = n.metadata;
    }
    if (n.children && n.children.length > 0) {
      out.children = pruneForExport(n.children);
    }
    return out;
  });
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Quote a CSV field if it contains a comma, quote, or newline (RFC 4180). */
export function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Escape a string literal for single-quoted SQL. */
export function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

/** Sanitize a title into a safe identifier for dot/mermaid/plantuml. */
export function sanitizeId(value: string): string {
  const id = value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  return id || '_';
}

// ---- Shared class/diagram model (mermaid + plantuml) -------------------------

const CLASS_TYPES = new Set([
  'class', 'interface', 'struct', 'enum', 'trait', 'object', 'type', 'union',
]);
const MEMBER_TYPES = new Set([
  'method', 'function', 'field', 'property', 'constructor', 'destructor',
  'enum-value', 'interface-method', 'interface-property', 'operator',
]);

export interface ClassMember {
  name: string;
  type: string;
  visibility: string; // '+', '-', '#', '~'
  isMethod: boolean;
  params: string[];
}

export interface ClassEntry {
  name: string;
  members: ClassMember[];
  /** Names of nested class-like children (composition edges). */
  nested: string[];
}

export interface ClassModel {
  isClassBearing: boolean;
  classes: ClassEntry[];
}

function visibilitySymbol(metadata?: Record<string, any>): string {
  switch (metadata?.visibility) {
    case 'private':
      return '-';
    case 'protected':
      return '#';
    case 'package':
    case 'internal':
      return '~';
    default:
      return '+';
  }
}

/** Extract a class model from an outline; decides class-diagram vs hierarchy. */
export function classModel(nodes: OutlineNode[]): ClassModel {
  const classes: ClassEntry[] = [];

  const collect = (node: OutlineNode): void => {
    if (CLASS_TYPES.has(node.type)) {
      const entry: ClassEntry = { name: node.title, members: [], nested: [] };
      for (const child of node.children ?? []) {
        if (CLASS_TYPES.has(child.type)) {
          entry.nested.push(child.title);
        } else if (MEMBER_TYPES.has(child.type)) {
          entry.members.push({
            name: child.title,
            type: child.type,
            visibility: visibilitySymbol(child.metadata),
            isMethod: child.type === 'method' || child.type === 'function' ||
              child.type === 'constructor' || child.type === 'interface-method',
            params: (child.metadata?.parameters ?? []).map((p: any) => p.name),
          });
        }
      }
      classes.push(entry);
    }
    for (const child of node.children ?? []) {
      collect(child);
    }
  };

  for (const node of nodes) {
    collect(node);
  }

  return { isClassBearing: classes.length > 0, classes };
}
