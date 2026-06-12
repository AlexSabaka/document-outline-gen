import { OutlineNode } from '../types';
import { escapeXml } from './util';

/**
 * XML export. Each node carries its scalars as attributes; children nest as
 * `<node>` elements and metadata becomes a `<metadata>` block of `<entry>`s
 * (complex values JSON-encoded).
 */
export function xml(nodes: OutlineNode[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<outline>\n${renderAll(nodes, 1)}</outline>\n`;
}

function renderAll(nodes: OutlineNode[], depth: number): string {
  return nodes.map((n) => renderNode(n, depth)).join('');
}

function renderNode(node: OutlineNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const attrs = [`title="${escapeXml(node.title)}"`, `type="${escapeXml(node.type)}"`, `depth="${node.depth}"`];
  if (node.line !== undefined) {
    attrs.push(`line="${node.line}"`);
  }

  const inner: string[] = [];
  if (node.metadata && Object.keys(node.metadata).length > 0) {
    inner.push(renderMetadata(node.metadata, depth + 1));
  }
  if (node.children && node.children.length > 0) {
    inner.push(renderAll(node.children, depth + 1));
  }

  if (inner.length === 0) {
    return `${pad}<node ${attrs.join(' ')}/>\n`;
  }
  return `${pad}<node ${attrs.join(' ')}>\n${inner.join('')}${pad}</node>\n`;
}

function renderMetadata(metadata: Record<string, unknown>, depth: number): string {
  const pad = '  '.repeat(depth);
  const entries = Object.entries(metadata)
    .map(([key, value]) => {
      const raw = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${pad}  <entry key="${escapeXml(key)}" value="${escapeXml(raw)}"/>\n`;
    })
    .join('');
  return `${pad}<metadata>\n${entries}${pad}</metadata>\n`;
}
