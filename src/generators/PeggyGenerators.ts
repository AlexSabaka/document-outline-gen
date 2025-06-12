import { FromPeggyGrammarGenerator } from './FromPeggyGrammarGenerator';
import * as path from 'path';

/**
 * Markdown generator using Peggy grammar
 * Supports headers, code blocks, lists with permissive parsing
 */
export class PeggyMarkdownGenerator extends FromPeggyGrammarGenerator {
  constructor() {
    const grammarPath = path.join(__dirname, '../grammars/markdown.pegjs');
    super(grammarPath, ['md', 'markdown']);
  }
}

/**
 * CSV generator using Peggy grammar
 * Advanced column analysis with type inference and statistics
 */
export class PeggyCsvGenerator extends FromPeggyGrammarGenerator {
  constructor() {
    const grammarPath = path.join(__dirname, '../grammars/csv.pegjs');
    super(grammarPath, ['csv']);
  }
}
