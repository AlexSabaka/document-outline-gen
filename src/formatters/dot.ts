import { OutlineNode } from '../types';
import { walk } from './util';

/** Graphviz DOT export — a containment digraph of the outline. */
export function dot(nodes: OutlineNode[]): string {
  const lines = ['digraph outline {', '  rankdir=LR;', '  node [shape=box];'];
  const edges: string[] = [];

  walk(nodes, ({ node, index, parentIndex }) => {
    const label = dotLabel(`${node.title}\\n[${node.type}]`);
    lines.push(`  n${index} [label="${label}"];`);
    if (parentIndex >= 0) {
      edges.push(`  n${parentIndex} -> n${index};`);
    }
  });

  return [...lines, ...edges, '}', ''].join('\n');
}

function dotLabel(value: string): string {
  // Escape quotes/backslashes but keep the literal \n produced above.
  return value.replace(/(["])/g, '\\$1').replace(/\n/g, ' ');
}
