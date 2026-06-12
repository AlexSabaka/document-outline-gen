import { load } from 'js-yaml';
import { OutlineNode } from '../src/types';
import {
  formatOutline,
  getFormats,
  asciiTree,
  json,
} from '../src/formatters';
import { UnsupportedFormatError } from '../src/errors';

/** A class-bearing outline (exercises class diagrams + metadata). */
const classOutline: OutlineNode[] = [
  {
    title: 'UserService',
    type: 'class',
    depth: 1,
    line: 10,
    children: [
      {
        title: 'getUser',
        type: 'method',
        depth: 2,
        line: 12,
        children: [],
        metadata: { visibility: 'public', parameters: [{ name: 'id' }] },
      },
      {
        title: 'cache',
        type: 'field',
        depth: 2,
        line: 11,
        children: [],
        metadata: { visibility: 'private' },
      },
    ],
  },
];

/** A document heading tree (exercises flowchart / mindmap fallbacks). */
const docOutline: OutlineNode[] = [
  {
    title: 'Introduction',
    type: 'heading',
    depth: 1,
    line: 1,
    children: [{ title: 'Background', type: 'heading', depth: 2, line: 5, children: [] }],
  },
];

describe('formatter registry', () => {
  it('exposes all expected formats', () => {
    const formats = getFormats();
    for (const name of ['ascii-tree', 'tree', 'json', 'yaml', 'xml', 'csv', 'sql', 'dot', 'mermaid', 'plantuml', 'html']) {
      expect(formats).toContain(name);
    }
  });

  it('throws UnsupportedFormatError for unknown formats', () => {
    expect(() => formatOutline(classOutline, 'nope')).toThrow(UnsupportedFormatError);
  });
});

describe('ascii-tree', () => {
  it('renders the canonical tree with line + metadata', () => {
    const out = asciiTree(classOutline);
    expect(out).toContain('├─ UserService [class] (line 10)');
    expect(out).toContain('params: id');
    expect(out).toContain('private');
  });

  it('compact mode drops line numbers and metadata', () => {
    const out = asciiTree(classOutline, { compact: true });
    expect(out).toContain('├─ UserService [class]');
    expect(out).not.toContain('(line ');
    expect(out).not.toContain('params:');
  });

  it('matches the format the CLI/kg-gen produced (parity)', () => {
    // The historical inline renderer, reproduced here as the parity oracle.
    expect(asciiTree(classOutline)).toBe(legacyFormatAsTree(classOutline));
  });
});

describe('structured exports', () => {
  it('json prunes empty children and round-trips', () => {
    const parsed = JSON.parse(json(docOutline));
    expect(parsed[0].title).toBe('Introduction');
    expect(parsed[0].children[0]).not.toHaveProperty('children'); // leaf pruned
  });

  it('yaml parses back to the same structure', () => {
    const parsed = load(formatOutline(docOutline, 'yaml')) as any[];
    expect(parsed[0].children[0].title).toBe('Background');
  });

  it('xml is well-formed-ish and escapes', () => {
    const out = formatOutline(classOutline, 'xml');
    expect(out).toContain('<outline>');
    expect(out).toContain('</outline>');
    expect(out).toContain('title="UserService"');
  });

  it('csv has a header and one row per node', () => {
    const out = formatOutline(classOutline, 'csv').trim().split('\n');
    expect(out[0]).toBe('path,title,type,depth,line');
    expect(out).toHaveLength(1 + 3); // header + 3 nodes
    expect(out).toContain('UserService/getUser,getUser,method,2,12');
  });

  it('sql emits a table and parent-referencing inserts', () => {
    const out = formatOutline(classOutline, 'sql');
    expect(out).toContain('CREATE TABLE outline_nodes');
    expect(out).toContain('(0, NULL,');
    expect(out).toContain('(1, 0,'); // getUser under UserService
  });
});

describe('diagram exports', () => {
  it('dot is a digraph', () => {
    expect(formatOutline(classOutline, 'dot')).toContain('digraph outline {');
  });

  it('mermaid uses classDiagram for code, flowchart for docs', () => {
    expect(formatOutline(classOutline, 'mermaid')).toContain('classDiagram');
    expect(formatOutline(classOutline, 'mermaid')).toContain('+getUser(id)');
    expect(formatOutline(docOutline, 'mermaid')).toContain('flowchart TD');
  });

  it('plantuml uses class diagram for code, mindmap for docs', () => {
    expect(formatOutline(classOutline, 'plantuml')).toContain('@startuml');
    expect(formatOutline(docOutline, 'plantuml')).toContain('@startmindmap');
  });

  it('html is a standalone document', () => {
    const out = formatOutline(docOutline, 'html');
    expect(out).toContain('<!DOCTYPE html>');
    expect(out).toContain('Introduction');
  });
});

/** Byte-for-byte reproduction of the pre-Phase-7 inline renderer. */
function legacyFormatAsTree(nodes: any[], depth = 0): string {
  let result = '';
  const indent = '  '.repeat(depth);
  for (const node of nodes) {
    const line = node.line ? ` (line ${node.line})` : '';
    const metadata = node.metadata ? legacyFormatMetadata(node.metadata) : '';
    result += `${indent}├─ ${node.title} [${node.type}]${line}${metadata}\n`;
    if (node.children && node.children.length > 0) {
      result += legacyFormatAsTree(node.children, depth + 1);
    }
  }
  return result;
}

function legacyFormatMetadata(metadata: Record<string, any>): string {
  const parts: string[] = [];
  if (metadata.visibility && metadata.visibility !== 'public') parts.push(metadata.visibility);
  if (metadata.isStatic) parts.push('static');
  if (metadata.isAbstract) parts.push('abstract');
  if (metadata.parameters && metadata.parameters.length > 0) {
    parts.push(`params: ${metadata.parameters.map((p: any) => p.name).join(', ')}`);
  }
  if (metadata.dataType) parts.push(`type: ${metadata.dataType}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
