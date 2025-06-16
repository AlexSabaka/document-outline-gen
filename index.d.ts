// Type definitions for document-outline-gen
// Project: https://github.com/alekssabaka/document-outline-gen
// Definitions by: Oleksii Sabaka

declare module 'document-outline-gen' {
  // Core types
  export interface OutlineNode {
    /** The title/name of the outline item */
    title: string;

    /** The type of the outline item (heading, function, class, etc.) */
    type: string;

    /** Line number where this item appears (1-based) */
    line?: number;

    /** Column number where this item appears (1-based) */
    column?: number;

    /** Depth/level of the item (1 for top-level) */
    depth: number;

    /** Child outline items */
    children?: OutlineNode[];

    /** Additional metadata specific to the generator */
    metadata?: Record<string, any>;

    /** Unique identifier for the item */
    id?: string;

    /** Anchor/link for the item (for web documents) */
    anchor?: string;
  }

  export interface GeneratorOptions {
    /** Include line numbers in the output */
    includeLineNumbers?: boolean;

    /** Maximum depth to traverse */
    maxDepth?: number;

    /** File name (used for context) */
    fileName?: string;

    /** Include private/internal items */
    includePrivate?: boolean;

    /** Include comments */
    includeComments?: boolean;

    /** Custom configuration per generator */
    [key: string]: any;
  }

  export interface Position {
    line: number;
    column: number;
  }

  export interface SchemaProperty {
    type: string;
    properties?: Record<string, SchemaProperty>;
    items?: SchemaProperty;
    required?: string[];
    description?: string;
  }

  export interface JsonSchema {
    type: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
    items?: SchemaProperty;
  }

  export interface CodeElement {
    name: string;
    type:
      | "annotation"
      | "package"
      | "include"
      | "import"
      | "using"
      | "constructor"
      | "destructor"
      | "namespace"
      | "class"
      | "typedef"
      | "macro"
      | "function"
      | "method"
      | "interface-method"
      | "operator"
      | "property"
      | "interface-property"
      | "field"
      | "variable"
      | "interface"
      | "union"
      | "enum"
      | "enum-value"
      | "type"
      | "struct";
    visibility?: "package" | "public" | "private" | "protected" | "internal";
    isStatic?: boolean;
    isAbstract?: boolean;
    parameters?: Parameter[];
    returnType?: string;
    position?: Position;
    docstring?: string;
    metadata?: Record<string, any>;
  }

  export interface Parameter {
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
  }

  export interface ParseError {
    message: string;
    line?: number;
    column?: number;
  }

  // Abstract base generator class
  export abstract class OutlineGenerator {
    /**
     * Generate outline structure from content
     */
    abstract generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;

    /**
     * Get file extensions supported by this generator
     */
    abstract getSupportedExtensions(): string[];

    /**
     * Utility method to create a basic outline node
     */
    protected createNode(
      title: string,
      type: string,
      depth: number,
      position?: Position,
      metadata?: Record<string, any>
    ): OutlineNode;

    /**
     * Utility method to generate unique ID for a node
     */
    protected generateId(title: string, type: string, line?: number): string;

    /**
     * Utility method to create anchor from title
     */
    protected createAnchor(title: string): string;

    /**
     * Utility method to build hierarchical structure from flat list
     */
    protected buildHierarchy(nodes: OutlineNode[]): OutlineNode[];

    /**
     * Utility method to count lines and get position
     */
    protected getPosition(content: string, index: number): Position;

    /**
     * Utility method to filter nodes by depth
     */
    protected filterByDepth(nodes: OutlineNode[], maxDepth?: number): OutlineNode[];
  }

  // Specific generator classes
  export class MarkdownGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class JsonGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class XmlGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class YamlGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class HtmlGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class CsvGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  // Code generators
  export class JavaScriptGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class TypeScriptGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class PythonGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class JavaGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class CSharpGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class CppGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  export class EmptyGenerator extends OutlineGenerator {
    generate(content: string, options?: GeneratorOptions): Promise<OutlineNode[]>;
    getSupportedExtensions(): string[];
  }

  // Main class
  export class DocumentOutlineGenerator {
    constructor();

    /**
     * Register a custom generator for a file extension
     */
    registerGenerator(extension: string, generator: OutlineGenerator): void;

    /**
     * Generate outline structure from file path
     */
    generateFromFile(
      filePath: string, 
      options?: GeneratorOptions
    ): Promise<OutlineNode[]>;

    /**
     * Generate outline structure from content string
     */
    generateFromContent(
      content: string, 
      fileExtension: string, 
      options?: GeneratorOptions
    ): Promise<OutlineNode[]>;

    /**
     * Get list of supported file extensions
     */
    getSupportedExtensions(): string[];

    /**
     * Check if file extension is supported
     */
    isSupported(fileExtension: string): boolean;
  }

  // Default export
  const DocumentOutlineGeneratorDefault: typeof DocumentOutlineGenerator;
  export default DocumentOutlineGeneratorDefault;
}
