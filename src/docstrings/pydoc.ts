import { DocComment, DocParam } from '../types';
import { assemble } from './jsdoc';

/**
 * Python docstrings: auto-detects Sphinx/reST (`:param x:`), NumPy
 * (`Parameters\n----------`), or Google (`Args:`) style. Falls back to a
 * summary-only result.
 */
export function parsePydoc(text: string): DocComment | undefined {
  if (/(^|\n)\s*:(param|returns?|rtype)\b/.test(text)) {
    return parseSphinx(text);
  }
  if (/\n[ \t]*(Parameters|Returns|Arguments)[ \t]*\n[ \t]*-{3,}/.test(text)) {
    return parseNumpy(text);
  }
  if (/(^|\n)[ \t]*(Args|Arguments|Parameters|Returns|Yields|Raises):[ \t]*$/m.test(text)) {
    return parseGoogle(text);
  }
  const summary = firstBlock(text);
  return summary ? { summary } : undefined;
}

function firstBlock(text: string): string {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (out.length > 0) {
        break;
      }
      continue;
    }
    out.push(line);
  }
  return out.join(' ').trim();
}

function parseSphinx(text: string): DocComment | undefined {
  const params = new Map<string, DocParam>();
  let returns: DocComment['returns'];
  const summaryLines: string[] = [];
  let inFields = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith(':')) {
      inFields = true;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^:param\s+(?:(\S+)\s+)?(\S+):\s*(.*)$/))) {
      const param = params.get(m[2]) ?? { name: m[2] };
      if (m[1]) {
        param.type = m[1];
      }
      if (m[3].trim()) {
        param.description = m[3].trim();
      }
      params.set(m[2], param);
    } else if ((m = line.match(/^:type\s+(\S+):\s*(.*)$/))) {
      const param = params.get(m[1]) ?? { name: m[1] };
      param.type = m[2].trim();
      params.set(m[1], param);
    } else if ((m = line.match(/^:returns?:\s*(.*)$/))) {
      returns = { ...(returns ?? {}), description: m[1].trim() || undefined };
    } else if ((m = line.match(/^:rtype:\s*(.*)$/))) {
      returns = { ...(returns ?? {}), type: m[1].trim() || undefined };
    } else if (!inFields && line) {
      summaryLines.push(line);
    }
  }
  return assemble(summaryLines, [...params.values()], returns);
}

function parseNumpy(text: string): DocComment | undefined {
  const lines = text.split('\n');
  const summaryLines: string[] = [];
  const params: DocParam[] = [];
  let returns: DocComment['returns'];
  let section: 'summary' | 'params' | 'returns' | 'other' = 'summary';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const next = (lines[i + 1] ?? '').trim();
    if (trimmed && /^-{3,}$/.test(next)) {
      const header = trimmed.toLowerCase();
      section = header.startsWith('param') || header.startsWith('arg')
        ? 'params'
        : header.startsWith('return')
          ? 'returns'
          : 'other';
      i++; // consume the dashes line
      continue;
    }
    if (!trimmed) {
      continue;
    }
    if (section === 'summary') {
      summaryLines.push(trimmed);
    } else if (section === 'params') {
      const m = trimmed.match(/^(\*{0,2}[\w]+)\s*:\s*(.*)$/);
      if (m) {
        params.push({ name: m[1], type: m[2].trim() || undefined });
      } else if (params.length > 0) {
        const last = params[params.length - 1];
        last.description = `${last.description ? last.description + ' ' : ''}${trimmed}`;
      }
    } else if (section === 'returns') {
      returns = returns ?? {};
      if (!returns.type) {
        returns.type = trimmed;
      } else {
        returns.description = `${returns.description ? returns.description + ' ' : ''}${trimmed}`;
      }
    }
  }
  return assemble(summaryLines, params, returns);
}

function parseGoogle(text: string): DocComment | undefined {
  const summaryLines: string[] = [];
  const params: DocParam[] = [];
  let returns: DocComment['returns'];
  let section: 'summary' | 'args' | 'returns' | 'other' = 'summary';

  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    const header = trimmed.match(/^(Args|Arguments|Parameters|Returns|Yields|Raises):$/);
    if (header) {
      const h = header[1].toLowerCase();
      section = h === 'returns' || h === 'yields'
        ? 'returns'
        : h.startsWith('arg') || h === 'parameters'
          ? 'args'
          : 'other';
      continue;
    }
    if (!trimmed) {
      continue;
    }
    if (section === 'summary') {
      summaryLines.push(trimmed);
    } else if (section === 'args') {
      const m = trimmed.match(/^(\*{0,2}\w+)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/);
      if (m) {
        params.push({ name: m[1], type: m[2]?.trim() || undefined, description: m[3].trim() || undefined });
      } else if (params.length > 0) {
        const last = params[params.length - 1];
        last.description = `${last.description ? last.description + ' ' : ''}${trimmed}`;
      }
    } else if (section === 'returns') {
      const m = trimmed.match(/^([\w.\[\], ]+):\s*(.*)$/);
      if (m && !returns) {
        returns = { type: m[1].trim(), description: m[2].trim() || undefined };
      } else {
        returns = returns ?? {};
        returns.description = `${returns.description ? returns.description + ' ' : ''}${trimmed}`;
      }
    }
  }
  return assemble(summaryLines, params, returns);
}
