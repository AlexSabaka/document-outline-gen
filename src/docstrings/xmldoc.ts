import { load } from 'cheerio';
import { DocComment, DocParam } from '../types';

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * C# XML doc comments: `<summary>`, `<param name="x">desc</param>`,
 * `<returns>desc</returns>`. Parsed leniently with cheerio in XML mode.
 */
export function parseXmlDoc(text: string): DocComment | undefined {
  let $: ReturnType<typeof load>;
  try {
    $ = load(`<doc>${text}</doc>`, { xmlMode: true });
  } catch {
    return undefined;
  }

  const doc: DocComment = {};
  const summary = clean($('summary').first().text());
  if (summary) {
    doc.summary = summary;
  }

  const params: DocParam[] = [];
  $('param').each((_, el) => {
    const name = $(el).attr('name');
    if (name) {
      params.push({ name, description: clean($(el).text()) || undefined });
    }
  });
  if (params.length > 0) {
    doc.params = params;
  }

  const returns = clean($('returns').first().text());
  if (returns) {
    doc.returns = { description: returns };
  }

  return Object.keys(doc).length > 0 ? doc : undefined;
}
