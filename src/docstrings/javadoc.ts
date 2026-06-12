import { DocComment, DocParam } from '../types';
import { assemble } from './jsdoc';

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Javadoc: `@param name desc`, `@return desc` (no `{type}` braces). Inline HTML
 * and `{@link ...}` tags are stripped from descriptions.
 */
export function parseJavadoc(text: string): DocComment | undefined {
  const params: DocParam[] = [];
  const summaryLines: string[] = [];
  let returns: DocComment['returns'];
  let inTags = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/\{@\w+\s+([^}]*)\}/g, '$1');
    if (line.startsWith('@')) {
      inTags = true;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^@param\s+(\S+)\s*(.*)$/))) {
      params.push({ name: m[1], description: stripHtml(m[2]) || undefined });
    } else if ((m = line.match(/^@returns?\s+(.*)$/))) {
      returns = { description: stripHtml(m[1]) || undefined };
    } else if (!inTags && line) {
      summaryLines.push(stripHtml(line));
    }
  }

  return assemble(summaryLines, params, returns);
}
