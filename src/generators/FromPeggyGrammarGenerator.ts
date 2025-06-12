import { OutlineGenerator } from './OutlineGenerator';
import { OutlineNode, GeneratorOptions } from '../types';
import * as peggy from 'peggy';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A generator that uses Peggy.js grammars to parse content and extract outlines
 * This allows for highly customizable, permissive parsing of various file formats
 */
export class FromPeggyGrammarGenerator extends OutlineGenerator {
  private parser: any = null;
  private grammarPath: string;
  private supportedExtensions: string[];

  constructor(grammarPath: string, supportedExtensions: string[]) {
    super();
    this.grammarPath = grammarPath;
    this.supportedExtensions = supportedExtensions;
  }

  /**
   * Initialize the parser by loading and compiling the grammar
   */
  private async initializeParser(): Promise<void> {
    if (this.parser) {
      return; // Already initialized
    }

    try {
      // Read the grammar file
      const grammarSource = fs.readFileSync(this.grammarPath, 'utf-8');
      
      // Generate parser from grammar
      this.parser = peggy.generate(grammarSource, {
        // allowedStartRules: ['start', 'document', 'content'], // Common start rule names
        cache: true, // Enable caching for better performance
      });
    } catch (error) {
      throw new Error(`Failed to initialize Peggy parser from ${this.grammarPath}: ${error}`);
    }
  }

  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    await this.initializeParser();

    try {
      // Parse the content using the Peggy parser
      const result = this.parser.parse(content, {
        // Pass options to the parser if needed
        fileName: options.fileName,
        includeLineNumbers: options.includeLineNumbers,
        maxDepth: options.maxDepth,
        includeComments: options.includeComments,
        includePrivate: options.includePrivate,
      });

      // The grammar should return OutlineNode[] directly
      // If not, we might need to transform the result
      if (Array.isArray(result)) {
        return this.filterByDepth(result, options.maxDepth);
      }

      // If result is a single node, wrap it in an array
      if (result && typeof result === 'object' && result.title) {
        return this.filterByDepth([result], options.maxDepth);
      }

      // If result has a specific structure, try to extract nodes
      if (result && result.nodes && Array.isArray(result.nodes)) {
        return this.filterByDepth(result.nodes, options.maxDepth);
      }

      // Fallback: empty result
      return [];
    } catch (error) {
      // Graceful error handling - return partial results if possible
      console.warn(`Peggy parser failed for ${this.grammarPath}:`, error);
      
      // Try to extract whatever we can from the error
      if (error && typeof error === 'object' && 'partialResult' in error) {
        return Array.isArray(error.partialResult) ? error.partialResult : [];
      }

      return [];
    }
  }

  getSupportedExtensions(): string[] {
    return this.supportedExtensions;
  }

  /**
   * Create a new generator instance from a grammar file
   */
  static fromGrammarFile(grammarPath: string, supportedExtensions: string[]): FromPeggyGrammarGenerator {
    if (!fs.existsSync(grammarPath)) {
      throw new Error(`Grammar file not found: ${grammarPath}`);
    }

    return new FromPeggyGrammarGenerator(grammarPath, supportedExtensions);
  }

  /**
   * Create a new generator instance from inline grammar source
   */
  static fromGrammarSource(grammarSource: string, supportedExtensions: string[], tempDir?: string): FromPeggyGrammarGenerator {
    // Write grammar to temporary file
    const tempPath = tempDir ? path.join(tempDir, 'temp.pegjs') : path.join(__dirname, '../../temp.pegjs');
    fs.writeFileSync(tempPath, grammarSource);

    return new FromPeggyGrammarGenerator(tempPath, supportedExtensions);
  }

  /**
   * Utility to validate a grammar file
   */
  static validateGrammar(grammarPath: string): { valid: boolean; error?: string } {
    try {
      const grammarSource = fs.readFileSync(grammarPath, 'utf-8');
      peggy.generate(grammarSource);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Get parser info (useful for debugging)
   */
  getParserInfo(): { grammarPath: string; initialized: boolean; extensions: string[] } {
    return {
      grammarPath: this.grammarPath,
      initialized: !!this.parser,
      extensions: this.supportedExtensions,
    };
  }
}
