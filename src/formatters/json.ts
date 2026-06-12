import { OutlineNode } from '../types';
import { FormatterOptions } from './index';
import { pruneForExport } from './util';

/** JSON export — the pruned outline projection (empty children/metadata removed). */
export function json(nodes: OutlineNode[], options: FormatterOptions = {}): string {
  return JSON.stringify(pruneForExport(nodes), null, options.compact ? 0 : 2);
}
