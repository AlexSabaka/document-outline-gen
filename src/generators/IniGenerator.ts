import { GeneratorOptions, OutlineNode } from '../types';
import { OutlineGenerator } from './OutlineGenerator';

/**
 * INI / CFG / CONF outline generator. A simple line parser: `[section]` headers
 * become depth-1 `section` nodes and `key = value` / `key: value` lines become
 * `property` nodes nested under the current section (or at root before any
 * section). `;` and `#` start comments.
 *
 * `.conf` is best-effort — structured-config files (nginx, Apache, …) are not
 * INI and degrade to a flat outline rather than erroring.
 */
export class IniGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const roots: OutlineNode[] = [];
    let current: OutlineNode | null = null;
    const lines = content.replace(/\r\n?/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith(';') || line.startsWith('#')) {
        continue;
      }

      const section = line.match(/^\[(.+?)\]\s*$/);
      if (section) {
        const name = section[1].trim();
        current = this.createNode(name, 'section', 1, { line: i + 1, column: 1 });
        current.id = this.generateId(name, 'section', i + 1);
        roots.push(current);
        continue;
      }

      const kv = splitKeyValue(line);
      if (!kv) {
        continue;
      }
      const node = this.createNode(
        kv.key,
        'property',
        current ? 2 : 1,
        { line: i + 1, column: 1 },
        { value: kv.value },
      );
      node.id = this.generateId(kv.key, 'property', i + 1);
      (current ? current.children! : roots).push(node);
    }

    return this.filterByDepth(roots, options.maxDepth);
  }

  getSupportedExtensions(): string[] {
    return ['ini', 'cfg', 'conf'];
  }
}

/** Split a `key = value` / `key: value` line on the first separator. */
export function splitKeyValue(line: string): { key: string; value: string } | null {
  const eq = line.indexOf('=');
  const colon = line.indexOf(':');
  let idx = -1;
  if (eq >= 0 && colon >= 0) {
    idx = Math.min(eq, colon);
  } else if (eq >= 0) {
    idx = eq;
  } else if (colon >= 0) {
    idx = colon;
  }
  if (idx <= 0) {
    return null;
  }
  return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
}
