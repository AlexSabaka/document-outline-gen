import { GeneratorOptions } from '../types';
import { MarkupGenerator, MarkupItem } from './MarkupGenerator';

/** Fixed LaTeX sectioning hierarchy (lower rank = shallower). */
const SECTION_RANK: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
};

/** Environments worth surfacing as outline nodes (skips itemize/center/etc.). */
const ENVIRONMENTS = new Set([
  'figure', 'table', 'tabular', 'equation', 'align', 'theorem', 'lemma',
  'proof', 'definition', 'corollary', 'proposition', 'algorithm', 'listing',
  'lstlisting', 'verbatim', 'minted',
]);

const SECTION = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{(.+?)\}/;
const ENVIRON = /\\begin\{(\w+)\*?\}/g;

/**
 * LaTeX outline generator. The `\part…\subparagraph` sectioning commands form
 * the hierarchy, depth-normalized so a section-only article starts at depth 1.
 * Selected `\begin{env}` environments (figures, tables, theorems, …) attach as
 * leaves. `%` comments are ignored.
 */
export class LatexGenerator extends MarkupGenerator {
  getSupportedExtensions(): string[] {
    return ['tex', 'latex'];
  }

  protected parseItems(content: string): MarkupItem[] {
    const lines = content.replace(/\r\n?/g, '\n').split('\n').map(stripComment);

    // First pass: shallowest sectioning rank present, for normalization.
    let minRank = Infinity;
    for (const line of lines) {
      const m = line.match(SECTION);
      if (m) {
        minRank = Math.min(minRank, SECTION_RANK[m[1]]);
      }
    }
    if (!Number.isFinite(minRank)) {
      minRank = 0;
    }

    const items: MarkupItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const section = line.match(SECTION);
      if (section) {
        items.push({
          title: section[2].trim(),
          type: 'section',
          isSection: true,
          depth: SECTION_RANK[section[1]] - minRank + 1,
          line: i + 1,
        });
        continue;
      }

      for (const env of line.matchAll(ENVIRON)) {
        const name = env[1];
        if (ENVIRONMENTS.has(name)) {
          items.push({
            title: name,
            type: 'environment',
            isSection: false,
            line: i + 1,
          });
        }
      }
    }

    return items;
  }
}

/** Drop an unescaped `%` comment to end of line. */
function stripComment(line: string): string {
  const idx = line.search(/(?<!\\)%/);
  return idx >= 0 ? line.slice(0, idx) : line;
}
