import { GeneratorOptions } from '../types';
import { MarkupGenerator, MarkupItem } from './MarkupGenerator';

const HEADING = /^(={1,6})\s*(.+?)\s*\1\s*$/;

/**
 * MediaWiki markup outline generator. `== Heading ==` levels form the
 * hierarchy, normalized so the shallowest level present is depth 1 (MediaWiki
 * reserves `=` for the page title, so sections usually start at `==`).
 * `<syntaxhighlight>` / `<source>` code blocks attach as leaves. Deliberately
 * minimal — MediaWiki has no richer block structure.
 */
export class WikiGenerator extends MarkupGenerator {
  getSupportedExtensions(): string[] {
    return ['wiki', 'mediawiki'];
  }

  protected parseItems(content: string): MarkupItem[] {
    const lines = content.replace(/\r\n?/g, '\n').split('\n');

    // First pass: shallowest heading level present, for depth normalization.
    let minLevel = Infinity;
    for (const line of lines) {
      const m = line.match(HEADING);
      if (m) {
        minLevel = Math.min(minLevel, m[1].length);
      }
    }
    if (!Number.isFinite(minLevel)) {
      minLevel = 1;
    }

    const items: MarkupItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const heading = line.match(HEADING);
      if (heading) {
        items.push({
          title: heading[2].trim(),
          type: 'heading',
          isSection: true,
          depth: heading[1].length - minLevel + 1,
          line: i + 1,
        });
        continue;
      }

      const code = line.match(/<(?:syntaxhighlight|source)\b[^>]*\blang=["']?([\w+-]+)/i);
      if (code) {
        items.push({
          title: 'syntaxhighlight',
          type: 'block',
          isSection: false,
          line: i + 1,
          metadata: { language: code[1] },
        });
      }
    }

    return items;
  }
}
