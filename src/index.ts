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
import { UnsupportedExtensionError } from './errors';

export * from './generators/OutlineGenerator';
export * from './errors';

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
   * Generate outline structure from content string.
   *
   * Rejects with {@link UnsupportedExtensionError} when no generator is
   * registered for `fileExtension`. Callers that feed a broad mix of file
   * types (e.g. kg-gen's reader) should prefer {@link generateFromContentSafe}.
   */
  public async generateFromContent(
    content: string,
    fileExtension: string,
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    const generator = this.generators.get(fileExtension.toLowerCase());

    if (!generator) {
      throw new UnsupportedExtensionError(fileExtension.toLowerCase());
    }

    return generator.generate(content, options);
  }

  /**
   * Like {@link generateFromContent}, but never throws: returns `[]` for
   * unsupported extensions or on parse failure. Intended for callers that
   * scan heterogeneous file sets and treat "no outline" as a normal outcome.
   */
  public async generateFromContentSafe(
    content: string,
    fileExtension: string,
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    if (!this.isSupported(fileExtension)) {
      return [];
    }
    try {
      return await this.generateFromContent(content, fileExtension, options);
    } catch {
      return [];
    }
  }

  /**
   * Like {@link generateFromFile}, but never throws: returns `[]` for
   * unsupported extensions, unreadable files, or parse failure.
   */
  public async generateFromFileSafe(
    filePath: string,
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    if (!this.isSupported(extension)) {
      return [];
    }
    try {
      return await this.generateFromFile(filePath, options);
    } catch {
      return [];
    }
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