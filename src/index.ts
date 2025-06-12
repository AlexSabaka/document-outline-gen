import path from 'path';
import fs from 'fs/promises';
import { OutlineGenerator } from './generators/OutlineGenerator';
import { JavaScriptGenerator } from './generators/code/JavaScriptGenerator';
import { JsonGenerator } from './generators/JsonGenerator';
import { MarkdownGenerator } from './generators/MarkdownGenerator';
import { PythonGenerator } from './generators/code/PythonGenerator';
import { JavaGenerator } from './generators/code/JavaGenerator';
import { CSharpGenerator } from './generators/code/CSharpGenerator';
import { TypeScriptGenerator } from './generators/code/TypeScriptGenerator';
import { XmlGenerator } from './generators/XmlGenerator';
import { YamlGenerator } from './generators/YamlGenerator';
import { GeneratorOptions, OutlineNode } from './types';
import { HtmlGenerator } from './generators/HtmlGenerator';
import { CsvGenerator } from './generators/CsvGenerator';
import { CppGenerator } from './generators/code/CppGenerator';
import { FromPeggyGrammarGenerator } from './generators/FromPeggyGrammarGenerator';
import { PeggyMarkdownGenerator, PeggyCsvGenerator } from './generators/PeggyGenerators';

export * from './generators/OutlineGenerator';
export * from './generators/FromPeggyGrammarGenerator';

export class DocumentOutlineGenerator {
  private generators: Map<string, OutlineGenerator> = new Map();
  private usePeggyGenerators: boolean = false;

  constructor(options: { usePeggyGenerators?: boolean } = {}) {
    this.usePeggyGenerators = options.usePeggyGenerators || false;
    this.registerDefaultGenerators();
  }

  private registerDefaultGenerators(): void {
    // Document generators - use Peggy versions if enabled
    if (this.usePeggyGenerators) {
      this.generators.set('md', new PeggyMarkdownGenerator());
      this.generators.set('markdown', new PeggyMarkdownGenerator());
      this.generators.set('csv', new PeggyCsvGenerator());
    } else {
      this.generators.set('md', new MarkdownGenerator());
      this.generators.set('markdown', new MarkdownGenerator());
      this.generators.set('csv', new CsvGenerator());
    }
    
    this.generators.set('json', new JsonGenerator());
    this.generators.set('xml', new XmlGenerator());
    this.generators.set('yaml', new YamlGenerator());
    this.generators.set('yml', new YamlGenerator());
    this.generators.set('html', new HtmlGenerator());
    this.generators.set('htm', new HtmlGenerator());
    
    // Code generators
    this.generators.set('js', new JavaScriptGenerator());
    this.generators.set('jsx', new JavaScriptGenerator());
    this.generators.set('ts', new TypeScriptGenerator());
    this.generators.set('tsx', new TypeScriptGenerator());
    this.generators.set('py', new PythonGenerator());
    this.generators.set('java', new JavaGenerator());
    this.generators.set('cs', new CSharpGenerator());
    this.generators.set('cpp', new CppGenerator());
  }

  /**
   * Register a custom generator for a file extension
   */
  public registerGenerator(extension: string, generator: OutlineGenerator): void {
    this.generators.set(extension.toLowerCase(), generator);
  }

  /**
   * Generate outline structure from file path
   */
  public async generateFromFile(
    filePath: string, 
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const extension = path.extname(filePath).slice(1).toLowerCase();
    
    return this.generateFromContent(content, extension, {
      ...options,
      fileName: path.basename(filePath)
    });
  }

  /**
   * Generate outline structure from content string
   */
  public generateFromContent(
    content: string, 
    fileExtension: string, 
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    const generator = this.generators.get(fileExtension.toLowerCase());
    
    if (!generator) {
      throw new Error(`No generator found for file extension: ${fileExtension}`);
    }

    return generator.generate(content, options);
  }

  /**
   * Get list of supported file extensions
   */
  public getSupportedExtensions(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Check if file extension is supported
   */
  public isSupported(fileExtension: string): boolean {
    return this.generators.has(fileExtension.toLowerCase());
  }

  /**
   * Enable or disable Peggy-based generators
   */
  public setPeggyGenerators(enabled: boolean): void {
    this.usePeggyGenerators = enabled;
    this.registerDefaultGenerators(); // Re-register with new setting
  }

  /**
   * Register a custom Peggy grammar generator
   */
  public registerPeggyGenerator(
    extensions: string | string[], 
    grammarPath: string
  ): void {
    const extArray = Array.isArray(extensions) ? extensions : [extensions];
    const generator = FromPeggyGrammarGenerator.fromGrammarFile(grammarPath, extArray);
    
    for (const ext of extArray) {
      this.registerGenerator(ext, generator);
    }
  }

  /**
   * Get information about current generator configuration
   */
  public getGeneratorInfo(): {
    usePeggyGenerators: boolean;
    supportedExtensions: string[];
    peggyGrammars: string[];
  } {
    const peggyGrammars: string[] = [];
    
    for (const [ext, generator] of this.generators.entries()) {
      if (generator instanceof FromPeggyGrammarGenerator) {
        peggyGrammars.push(ext);
      }
    }
    
    return {
      usePeggyGenerators: this.usePeggyGenerators,
      supportedExtensions: this.getSupportedExtensions(),
      peggyGrammars
    };
  }
}

// Default export
export default DocumentOutlineGenerator;