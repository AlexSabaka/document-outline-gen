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
