import { OutlineNode } from '../types';
import { escapeSql, walk } from './util';

/**
 * SQL export — a portable `outline_nodes` table plus `INSERT`s with parent-id
 * references, for loading large corpus scans into a database.
 */
export function sql(nodes: OutlineNode[]): string {
  const lines = [
    'CREATE TABLE outline_nodes (',
    '  id INTEGER PRIMARY KEY,',
    '  parent_id INTEGER,',
    '  title TEXT,',
    '  type TEXT,',
    '  depth INTEGER,',
    '  line INTEGER',
    ');',
    '',
  ];

  walk(nodes, ({ node, depth, index, parentIndex }) => {
    const parent = parentIndex < 0 ? 'NULL' : String(parentIndex);
    const line = node.line !== undefined ? String(node.line) : 'NULL';
    lines.push(
      `INSERT INTO outline_nodes (id, parent_id, title, type, depth, line) VALUES ` +
        `(${index}, ${parent}, '${escapeSql(node.title)}', '${escapeSql(node.type)}', ${depth}, ${line});`,
    );
  });

  return lines.join('\n') + '\n';
}
