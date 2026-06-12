import { OutlineNode } from '../types';
import { escapeCsv, walk } from './util';

/**
 * CSV export — one flat row per node: `path,title,type,depth,line`, where
 * `path` is the `/`-joined ancestor titles. For spreadsheet analysis of large
 * corpus scans (no metadata, per the roadmap).
 */
export function csv(nodes: OutlineNode[]): string {
  const rows = ['path,title,type,depth,line'];
  walk(nodes, ({ node, depth, path }) => {
    const fullPath = [...path, node.title].join('/');
    rows.push(
      [
        escapeCsv(fullPath),
        escapeCsv(node.title),
        escapeCsv(node.type),
        String(depth),
        node.line !== undefined ? String(node.line) : '',
      ].join(','),
    );
  });
  return rows.join('\n') + '\n';
}
