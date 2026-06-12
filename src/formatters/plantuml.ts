import { OutlineNode } from '../types';
import { classModel, sanitizeId } from './util';

/**
 * PlantUML export. Class-bearing outlines render as a class diagram
 * (`@startuml`); document hierarchies render as a mind map (`@startmindmap`).
 */
export function plantuml(nodes: OutlineNode[]): string {
  const model = classModel(nodes);
  return model.isClassBearing ? classDiagram(model) : mindmap(nodes);
}

function classDiagram(model: ReturnType<typeof classModel>): string {
  const lines = ['@startuml'];
  for (const entry of model.classes) {
    const id = sanitizeId(entry.name);
    lines.push(`class "${entry.name}" as ${id} {`);
    for (const member of entry.members) {
      const vis = member.visibility;
      const sig = member.isMethod ? `${member.name}(${member.params.join(', ')})` : member.name;
      lines.push(`  ${vis}${sig}`);
    }
    lines.push('}');
    for (const child of entry.nested) {
      lines.push(`${id} *-- ${sanitizeId(child)}`);
    }
  }
  lines.push('@enduml');
  return lines.join('\n') + '\n';
}

function mindmap(nodes: OutlineNode[]): string {
  const lines = ['@startmindmap'];
  const render = (list: OutlineNode[], depth: number) => {
    for (const node of list) {
      lines.push(`${'*'.repeat(depth)} ${node.title}`);
      if (node.children && node.children.length > 0) {
        render(node.children, depth + 1);
      }
    }
  };
  render(nodes, 1);
  lines.push('@endmindmap');
  return lines.join('\n') + '\n';
}
