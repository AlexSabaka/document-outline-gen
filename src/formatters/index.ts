import { OutlineNode } from '../types';
import { UnsupportedFormatError } from '../errors';
import { asciiTree } from './asciiTree';
import { json } from './json';
import { yaml } from './yaml';
import { xml } from './xml';
import { csv } from './csv';
import { sql } from './sql';
import { dot } from './dot';
import { mermaid } from './mermaid';
import { plantuml } from './plantuml';
import { html } from './html';

/** Options passed to a formatter. `compact` is honoured by ascii-tree and json. */
export interface FormatterOptions {
  compact?: boolean;
  [key: string]: unknown;
}

/** Renders an outline tree into a string in some target format. */
export type OutlineFormatter = (nodes: OutlineNode[], options?: FormatterOptions) => string;

const formatters = new Map<string, OutlineFormatter>([
  ['ascii-tree', asciiTree],
  ['tree', asciiTree], // alias (CLI back-compat)
  ['json', json],
  ['yaml', yaml],
  ['xml', xml],
  ['csv', csv],
  ['sql', sql],
  ['dot', dot],
  ['mermaid', mermaid],
  ['plantuml', plantuml],
  ['html', html],
]);

/** Format names available via {@link formatOutline}, sorted, aliases included. */
export function getFormats(): string[] {
  return [...formatters.keys()].sort();
}

/** Register a custom formatter (or override a built-in). */
export function registerFormatter(name: string, formatter: OutlineFormatter): void {
  formatters.set(name.toLowerCase(), formatter);
}

/**
 * Render `nodes` in the named format. Throws {@link UnsupportedFormatError} for
 * an unknown format.
 */
export function formatOutline(
  nodes: OutlineNode[],
  format: string,
  options: FormatterOptions = {},
): string {
  const formatter = formatters.get(format.toLowerCase());
  if (!formatter) {
    throw new UnsupportedFormatError(format, getFormats());
  }
  return formatter(nodes, options);
}

export {
  asciiTree, json, yaml, xml, csv, sql, dot, mermaid, plantuml, html,
};
