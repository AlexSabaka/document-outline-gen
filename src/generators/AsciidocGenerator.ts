import { GeneratorOptions } from '../types';
import { MarkupGenerator, MarkupItem } from './MarkupGenerator';

/**
 * AsciiDoc outline generator. `=`-level headings form the hierarchy (the `=`
 * doc title is the depth-1 root; `==`/`===` sections nest under it). Block
 * attribute lines (`[source,python]`, `[NOTE]`, `[quote]`) attach as leaves.
 */
export class AsciidocGenerator extends MarkupGenerator {
  getSupportedExtensions(): string[] {
    return ['adoc', 'asciidoc'];
  }

  protected parseItems(content: string): MarkupItem[] {
    const items: MarkupItem[] = [];
    const lines = content.replace(/\r\n?/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Heading: one or more '=' then a space then text (delimiter lines like
      // '====' have no text and are skipped).
      const heading = line.match(/^(={1,6})\s+(.+)$/);
      if (heading) {
        items.push({
          title: heading[2].trim(),
          type: 'heading',
          isSection: true,
          depth: heading[1].length,
          line: i + 1,
        });
        continue;
      }

      // Block attribute line: [source,python] / [NOTE] / [quote, author]
      const attr = line.match(/^\[([^\]]+)\]\s*$/);
      if (attr) {
        const parts = attr[1].split(',').map((p) => p.trim());
        const meta: Record<string, unknown> = {};
        if (/^source$/i.test(parts[0]) && parts[1]) {
          meta.language = parts[1];
        }
        items.push({
          title: parts[0],
          type: 'block',
          isSection: false,
          line: i + 1,
          metadata: meta,
        });
      }
    }

    return items;
  }
}
