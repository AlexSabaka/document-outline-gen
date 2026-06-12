import { GeneratorOptions } from '../types';
import { MarkupGenerator, MarkupItem } from './MarkupGenerator';

const TODO_KEYWORDS = /^(TODO|DONE|NEXT|WAITING|CANCELLED)\b\s*/;
const PRIORITY = /^\[#[A-Z]\]\s*/;
const TAGS = /\s+(:[\w@%#:]+:)\s*$/;

/**
 * Org-mode outline generator. `*`-star headings form the hierarchy; `#+BEGIN_<TYPE>`
 * blocks attach as leaves. TODO keywords, `[#A]` priorities and `:tags:` are
 * stripped from the title into metadata.
 */
export class OrgGenerator extends MarkupGenerator {
  getSupportedExtensions(): string[] {
    return ['org'];
  }

  protected parseItems(content: string): MarkupItem[] {
    const items: MarkupItem[] = [];
    const lines = content.replace(/\r\n?/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const heading = line.match(/^(\*+)\s+(.+)$/);
      if (heading) {
        const depth = heading[1].length;
        const meta: Record<string, unknown> = {};
        let rest = heading[2].trim();

        const todo = rest.match(TODO_KEYWORDS);
        if (todo) {
          meta.todo = todo[1];
          rest = rest.slice(todo[0].length);
        }
        const priority = rest.match(PRIORITY);
        if (priority) {
          meta.priority = priority[0].slice(2, 3);
          rest = rest.slice(priority[0].length);
        }
        const tags = rest.match(TAGS);
        if (tags) {
          meta.tags = tags[1].split(':').filter(Boolean);
          rest = rest.slice(0, tags.index).trimEnd();
        }

        items.push({
          title: rest.trim(),
          type: 'heading',
          isSection: true,
          depth,
          line: i + 1,
          metadata: meta,
        });
        continue;
      }

      const block = line.match(/^\s*#\+begin_(\w+)(.*)$/i);
      if (block) {
        const type = block[1].toUpperCase();
        const meta: Record<string, unknown> = {};
        if (type === 'SRC') {
          const lang = block[2].trim().split(/\s+/)[0];
          if (lang) {
            meta.language = lang;
          }
        }
        items.push({
          title: type,
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
