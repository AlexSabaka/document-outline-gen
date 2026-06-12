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
import { GoGenerator } from './generators/code/GoGenerator';
import { RustGenerator } from './generators/code/RustGenerator';
import { RubyGenerator } from './generators/code/RubyGenerator';
import { PhpGenerator } from './generators/code/PhpGenerator';
import { KotlinGenerator } from './generators/code/KotlinGenerator';
import { SwiftGenerator } from './generators/code/SwiftGenerator';
import { ScalaGenerator } from './generators/code/ScalaGenerator';
import { LuaGenerator } from './generators/code/LuaGenerator';
import { TomlGenerator } from './generators/code/TomlGenerator';
import { IniGenerator } from './generators/IniGenerator';
import { PropertiesGenerator } from './generators/PropertiesGenerator';
import { RstGenerator } from './generators/RstGenerator';
import { AsciidocGenerator } from './generators/AsciidocGenerator';
import { LatexGenerator } from './generators/LatexGenerator';
import { OrgGenerator } from './generators/OrgGenerator';
import { WikiGenerator } from './generators/WikiGenerator';
import { UnsupportedExtensionError } from './errors';

export * from './generators/OutlineGenerator';
export * from './errors';
export * from './formatters';

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
    this.generators.set('ts', new TypeScriptGenerator('typescript'));
    this.generators.set('tsx', new TypeScriptGenerator('tsx'));
    this.generators.set('py', new PythonGenerator());
    this.generators.set('java', new JavaGenerator());
    this.generators.set('cs', new CSharpGenerator());
    this.generators.set('cpp', new CppGenerator());

    // Phase 4 languages
    this.generators.set('go', new GoGenerator());
    this.generators.set('rs', new RustGenerator());
    const ruby = new RubyGenerator();
    this.generators.set('rb', ruby);
    this.generators.set('rake', ruby);
    this.generators.set('gemspec', ruby);
    const php = new PhpGenerator();
    this.generators.set('php', php);
    this.generators.set('phtml', php);
    const kotlin = new KotlinGenerator();
    this.generators.set('kt', kotlin);
    this.generators.set('kts', kotlin);
    this.generators.set('swift', new SwiftGenerator());
    const scala = new ScalaGenerator();
    this.generators.set('scala', scala);
    this.generators.set('sbt', scala);
    this.generators.set('lua', new LuaGenerator());

    // Phase 5 config & data formats
    this.generators.set('toml', new TomlGenerator());
    const ini = new IniGenerator();
    this.generators.set('ini', ini);
    this.generators.set('cfg', ini);
    this.generators.set('conf', ini);
    const properties = new PropertiesGenerator();
    this.generators.set('properties', properties);
    this.generators.set('env', properties);

    // Phase 6 markup formats
    const rst = new RstGenerator();
    this.generators.set('rst', rst);
    this.generators.set('rest', rst);
    const asciidoc = new AsciidocGenerator();
    this.generators.set('adoc', asciidoc);
    this.generators.set('asciidoc', asciidoc);
    const latex = new LatexGenerator();
    this.generators.set('tex', latex);
    this.generators.set('latex', latex);
    this.generators.set('org', new OrgGenerator());
    const wiki = new WikiGenerator();
    this.generators.set('wiki', wiki);
    this.generators.set('mediawiki', wiki);
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