import { OutlineNode } from '../types';
import { escapeXml } from './util';

/** Standalone HTML export — a nested `<ul>` outline with anchors, no framework. */
export function html(nodes: OutlineNode[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Outline</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #222; }
  ul { list-style: none; padding-left: 1.2rem; border-left: 1px solid #ddd; }
  li { margin: 0.15rem 0; }
  .type { color: #888; font-size: 0.85em; }
  .line { color: #bbb; font-size: 0.8em; }
</style>
</head>
<body>
<h1>Outline</h1>
${renderList(nodes, 0)}</body>
</html>
`;
}

function renderList(nodes: OutlineNode[], depth: number): string {
  const pad = '  '.repeat(depth);
  let out = `${pad}<ul>\n`;
  for (const node of nodes) {
    const anchor = node.anchor ? ` id="${escapeXml(node.anchor)}"` : '';
    const line = node.line ? ` <span class="line">(line ${node.line})</span>` : '';
    out += `${pad}  <li${anchor}>${escapeXml(node.title)} <span class="type">[${escapeXml(node.type)}]</span>${line}\n`;
    if (node.children && node.children.length > 0) {
      out += renderList(node.children, depth + 2);
    }
    out += `${pad}  </li>\n`;
  }
  out += `${pad}</ul>\n`;
  return out;
}
