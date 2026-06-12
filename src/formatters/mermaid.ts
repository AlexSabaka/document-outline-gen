import { OutlineNode } from '../types';
import { classModel, sanitizeId, walk } from './util';

/**
 * Mermaid export. Class-bearing outlines (code with classes/interfaces/…) render
 * as a `classDiagram`; document hierarchies render as a `flowchart TD`.
 */
export function mermaid(nodes: OutlineNode[]): string {
  const model = classModel(nodes);
  return model.isClassBearing ? classDiagram(model) : flowchart(nodes);
}

function classDiagram(model: ReturnType<typeof classModel>): string {
  const lines = ['classDiagram'];
  for (const entry of model.classes) {
    const id = sanitizeId(entry.name);
    lines.push(`  class ${id}["${entry.name}"] {`);
    for (const member of entry.members) {
      const sig = member.isMethod ? `${member.name}(${member.params.join(', ')})` : member.name;
      lines.push(`    ${member.visibility}${sig}`);
    }
    lines.push('  }');
    for (const child of entry.nested) {
      lines.push(`  ${id} *-- ${sanitizeId(child)}`);
    }
  }
  return lines.join('\n') + '\n';
}

function flowchart(nodes: OutlineNode[]): string {
  const lines = ['flowchart TD'];
  const edges: string[] = [];
  walk(nodes, ({ node, index, parentIndex }) => {
    const label = node.title.replace(/"/g, "'");
    lines.push(`  n${index}["${label}"]`);
    if (parentIndex >= 0) {
      edges.push(`  n${parentIndex} --> n${index}`);
    }
  });
  return [...lines, ...edges].join('\n') + '\n';
}
