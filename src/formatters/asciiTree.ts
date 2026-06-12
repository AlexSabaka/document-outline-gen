import { OutlineNode } from '../types';
import { FormatterOptions } from './index';

/**
 * ASCII tree renderer — the canonical outline view, ported verbatim from the
 * CLI / kg-gen `formatAsTree` so this library is the single source of truth.
 * kg-gen renders this string into `{{fileOutline}}` prompts.
 *
 * `compact` drops line numbers and the metadata suffix for token-lean output.
 */
export function asciiTree(nodes: OutlineNode[], options: FormatterOptions = {}): string {
  return render(nodes, 0, options.compact === true);
}

function render(nodes: OutlineNode[], depth: number, compact: boolean): string {
  let result = '';
  const indent = '  '.repeat(depth);

  for (const node of nodes) {
    const line = !compact && node.line ? ` (line ${node.line})` : '';
    const metadata = !compact && node.metadata ? formatMetadata(node.metadata) : '';
    result += `${indent}├─ ${node.title} [${node.type}]${line}${metadata}\n`;

    if (node.children && node.children.length > 0) {
      result += render(node.children, depth + 1, compact);
    }
  }

  return result;
}

function formatMetadata(metadata: Record<string, any>): string {
  const parts: string[] = [];

  if (metadata.visibility && metadata.visibility !== 'public') {
    parts.push(metadata.visibility);
  }
  if (metadata.isStatic) {
    parts.push('static');
  }
  if (metadata.isAbstract) {
    parts.push('abstract');
  }
  if (metadata.parameters && metadata.parameters.length > 0) {
    const params = metadata.parameters.map((p: any) => p.name).join(', ');
    parts.push(`params: ${params}`);
  }
  if (metadata.dataType) {
    parts.push(`type: ${metadata.dataType}`);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
