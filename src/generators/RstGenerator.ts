import { GeneratorOptions } from '../types';
import { MarkupGenerator, MarkupItem } from './MarkupGenerator';

const ADORNMENT = /^([^\w\s])\1+$/;
const DIRECTIVE = /^\.\.\s+([\w-]+)::\s*(.*)$/;

/**
 * reStructuredText outline generator. Section depth follows RST's rule: a title
 * underlined (and optionally overlined) by a run of punctuation, where the depth
 * is the order in which each *adornment style* first appears — overline+char and
 * underline+char are distinct styles. `.. name::` directives attach as leaves.
 */
export class RstGenerator extends MarkupGenerator {
  getSupportedExtensions(): string[] {
    return ['rst', 'rest'];
  }

  protected parseItems(content: string): MarkupItem[] {
    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    const items: MarkupItem[] = [];
    const styleOrder: string[] = [];

    const depthFor = (style: string): number => {
      let idx = styleOrder.indexOf(style);
      if (idx === -1) {
        idx = styleOrder.push(style) - 1;
      }
      return idx + 1;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Overline + title + underline (same punctuation char).
      if (isAdornment(line) && i + 2 < lines.length) {
        const char = trimmed[0];
        const title = lines[i + 1].trim();
        const under = lines[i + 2];
        if (
          title &&
          !isAdornment(lines[i + 1]) &&
          isAdornment(under) &&
          under.trim()[0] === char &&
          trimmed.length >= title.length &&
          under.trim().length >= title.length
        ) {
          items.push(this.section(title, depthFor(`over:${char}`), i + 2));
          i += 2;
          continue;
        }
      }

      // Title + underline.
      if (trimmed && !isAdornment(line) && i + 1 < lines.length && isAdornment(lines[i + 1])) {
        const under = lines[i + 1].trim();
        if (under.length >= trimmed.length && !DIRECTIVE.test(trimmed)) {
          items.push(this.section(trimmed, depthFor(`under:${under[0]}`), i + 1));
          i += 1;
          continue;
        }
      }

      // Directive.
      const directive = trimmed.match(DIRECTIVE);
      if (directive) {
        const arg = directive[2].trim();
        items.push({
          title: directive[1],
          type: 'directive',
          isSection: false,
          line: i + 1,
          metadata: arg ? { argument: arg } : undefined,
        });
      }
    }

    return items;
  }

  private section(title: string, depth: number, line: number): MarkupItem {
    return { title, type: 'heading', isSection: true, depth, line };
  }
}

function isAdornment(line: string): boolean {
  return ADORNMENT.test(line.trim());
}
