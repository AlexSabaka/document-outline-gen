import { DocComment, DocParam } from '../types';

/**
 * JSDoc / TSDoc / Doxygen-`@`-style: `@param {type} name desc`,
 * `@returns {type} desc`. The `{type}` and leading `-` are optional.
 */
export function parseJsdoc(text: string): DocComment | undefined {
  const params: DocParam[] = [];
  const summaryLines: string[] = [];
  let returns: DocComment['returns'];
  let inTags = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@')) {
      inTags = true;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^@param\s+(?:\{([^}]*)\}\s*)?\[?([\w.$]+)\]?\s*-?\s*(.*)$/))) {
      params.push({
        name: m[2],
        type: m[1] || undefined,
        description: m[3].trim() || undefined,
      });
    } else if ((m = line.match(/^@returns?\s+(?:\{([^}]*)\}\s*)?(.*)$/))) {
      returns = { type: m[1] || undefined, description: m[2].trim() || undefined };
    } else if (!inTags && line) {
      summaryLines.push(line);
    }
  }

  return assemble(summaryLines, params, returns);
}

export function assemble(
  summaryLines: string[],
  params: DocParam[],
  returns: DocComment['returns'],
): DocComment | undefined {
  const doc: DocComment = {};
  const summary = summaryLines.join(' ').trim();
  if (summary) {
    doc.summary = summary;
  }
  if (params.length > 0) {
    doc.params = params;
  }
  if (returns && (returns.type || returns.description)) {
    doc.returns = returns;
  }
  return Object.keys(doc).length > 0 ? doc : undefined;
}
