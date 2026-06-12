import { DocComment } from '../types';
import { parseJsdoc } from './jsdoc';
import { parseJavadoc } from './javadoc';
import { parseXmlDoc } from './xmldoc';
import { parsePydoc } from './pydoc';

export type DocStyle = 'jsdoc' | 'javadoc' | 'xmldoc' | 'pydoc';

/**
 * Parse an already-cleaned doc comment (comment markers stripped) into a
 * structured {@link DocComment}. Returns undefined when nothing useful parses.
 */
export function parseDocComment(style: DocStyle, raw: string): DocComment | undefined {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }
  switch (style) {
    case 'jsdoc':
      return parseJsdoc(text);
    case 'javadoc':
      return parseJavadoc(text);
    case 'xmldoc':
      return parseXmlDoc(text);
    case 'pydoc':
      return parsePydoc(text);
    default:
      return undefined;
  }
}

export type { DocComment };
