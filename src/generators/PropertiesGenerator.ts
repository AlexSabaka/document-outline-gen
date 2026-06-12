import { GeneratorOptions, OutlineNode } from '../types';
import { OutlineGenerator } from './OutlineGenerator';
import { splitKeyValue } from './IniGenerator';

/**
 * Java `.properties` / `.env` outline generator. Flat key-value per the spec:
 * `key=value` or `key:value`, `#`/`!` line comments, backslash line
 * continuations, plus an optional `export ` prefix and surrounding quotes for
 * `.env` files. Every entry is a depth-1 `property` node carrying its value in
 * metadata.
 *
 * NOTE: `path.extname('.env')` is '' for a bare dotfile, so a bare `.env` won't
 * dispatch through `generateFromFile`; `*.env` files and direct
 * `generateFromContent(content, 'env')` calls do. See TECHDEBT.md.
 */
export class PropertiesGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const roots: OutlineNode[] = [];
    const lines = content.replace(/\r\n?/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue;
      }

      const startLine = i + 1;
      // Join backslash line continuations.
      while (line.endsWith('\\') && i + 1 < lines.length) {
        line = line.slice(0, -1) + lines[++i];
      }

      const kv = splitKeyValue(line.trim().replace(/^export\s+/, ''));
      if (!kv) {
        continue;
      }
      const node = this.createNode(
        kv.key,
        'property',
        1,
        { line: startLine, column: 1 },
        { value: unquote(kv.value) },
      );
      node.id = this.generateId(kv.key, 'property', startLine);
      roots.push(node);
    }

    return this.filterByDepth(roots, options.maxDepth);
  }

  getSupportedExtensions(): string[] {
    return ['properties', 'env'];
  }
}

/** Strip a single pair of matching surrounding quotes (.env style). */
function unquote(value: string): string {
  const m = value.match(/^"(.*)"$/) || value.match(/^'(.*)'$/);
  return m ? m[1] : value;
}
