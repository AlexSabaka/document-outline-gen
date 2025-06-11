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

export * from './generators/OutlineGenerator';

export class DocumentOutlineGenerator {
  private generators: Map<string, OutlineGenerator> = new Map();

  constructor() {
    this.registerDefaultGenerators();
  }

  private registerDefaultGenerators(): void {
    // Document generators
    this.generators.set('md', new MarkdownGenerator());
    this.generators.set('markdown', new MarkdownGenerator());
    this.generators.set('json', new JsonGenerator());
    this.generators.set('xml', new XmlGenerator());
    this.generators.set('yaml', new YamlGenerator());
    this.generators.set('yml', new YamlGenerator());
    this.generators.set('html', new HtmlGenerator());
    this.generators.set('htm', new HtmlGenerator());
    this.generators.set('csv', new CsvGenerator());
    
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
}

// Default export
export default DocumentOutlineGenerator;