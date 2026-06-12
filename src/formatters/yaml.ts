import { dump } from 'js-yaml';
import { OutlineNode } from '../types';
import { pruneForExport } from './util';

/** YAML export of the pruned outline projection. */
export function yaml(nodes: OutlineNode[]): string {
  return dump(pruneForExport(nodes), { lineWidth: -1, noRefs: true });
}
