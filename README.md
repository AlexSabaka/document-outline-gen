# Document Outline Generator

A universal document outline structure generator for various file types and programming languages. Perfect for knowledge graphs, documentation tools, and content analysis.

[![npm version](https://badge.fury.io/js/document-outline-generator.svg)](https://badge.fury.io/js/document-outline-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Multi-format Support**: Handles documents (Markdown, JSON, XML, YAML, HTML) and code files
- **Code Analysis**: Deep AST parsing for TypeScript, JavaScript, Python, Java, C#
- **Hierarchical Structure**: Maintains proper parent-child relationships
- **Rich Metadata**: Line numbers, visibility, parameters, docstrings, and more
- **Extensible Architecture**: Easy to add support for new file types
- **CLI Tool**: Command-line interface for batch processing
- **TypeScript First**: Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install document-outline-generator
```

For CLI usage:
```bash
npm install -g document-outline-generator
```

## 🎯 Quick Start

### Basic Usage

```typescript
import DocumentOutlineGenerator from 'document-outline-generator';

const generator = new DocumentOutlineGenerator();

// Analyze a file
const outline = await generator.generateFromFile('./example.md');
console.log(JSON.stringify(outline, null, 2));

// Analyze content directly
const outline = await generator.generateFromContent(
  '# Title\n## Subtitle\nContent here', 
  'md'
);
```

### With Options

```typescript
const outline = await generator.generateFromFile('./src/app.ts', {
  includeLineNumbers: true,
  maxDepth: 3,
  includePrivate: false,
  includeComments: true
});
```

### CLI Usage

```bash
# Basic analysis
document-outline-generator example.ts

# With options
document-outline-generator src/app.py --line-numbers --max-depth 2 --format json

# Save to file
document-outline-generator README.md --output outline.json

# List supported extensions
document-outline-generator list-extensions
```

## 📋 Supported File Types

| Extension | Type | Features |
|-----------|------|----------|
| `.md`, `.markdown` | Markdown | Headings (H1-H6), frontmatter support |
| `.json` | JSON | Schema analysis, nested object structure |
| `.xml` | XML | Element hierarchy, attributes detection |
| `.yaml`, `.yml` | YAML | Object structure, array handling |
| `.html`, `.htm` | HTML | Headings, semantic elements (`<section>`, `<article>`, etc.) |
| `.ts`, `.tsx` | TypeScript | Classes, interfaces, functions, types, enums |
| `.js`, `.jsx` | JavaScript | Classes, functions, variables, methods |
| `.py` | Python | Classes, functions, methods, properties, decorators |
| `.java` | Java | Classes, methods, fields, constructors |
| `.cs` | C# | Classes, methods, properties, events |

## 📊 Output Format

### OutlineNode Structure

```typescript
interface OutlineNode {
  title: string;              // Name/title of the item
  type: string;               // Type: heading, function, class, etc.
  depth: number;              // Nesting level (1 = top-level)
  line?: number;              // Line number (1-based)
  column?: number;            // Column number (1-based)
  children?: OutlineNode[];   // Child items
  metadata?: {                // Additional information
    visibility?: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAbstract?: boolean;
    parameters?: Parameter[];
    returnType?: string;
    docstring?: string;
    // ... more metadata based on file type
  };
  id?: string;               // Unique identifier
  anchor?: string;           // Link anchor (for web documents)
}
```

### Example Outputs

#### Markdown File
```json
[
  {
    "title": "Introduction",
    "type": "heading",
    "depth": 1,
    "line": 1,
    "anchor": "introduction",
    "children": [
      {
        "title": "Getting Started",
        "type": "heading",
        "depth": 2,
        "line": 5,
        "anchor": "getting-started"
      }
    ]
  }
]
```

#### TypeScript Class
```json
[
  {
    "title": "UserService",
    "type": "class",
    "depth": 1,
    "line": 10,
    "children": [
      {
        "title": "constructor",
        "type": "method",
        "depth": 2,
        "line": 12,
        "metadata": {
          "visibility": "public",
          "parameters": [
            {"name": "apiKey", "type": "string"}
          ]
        }
      },
      {
        "title": "getUser",
        "type": "method",
        "depth": 2,
        "line": 16,
        "metadata": {
          "visibility": "public",
          "parameters": [
            {"name": "id", "type": "number"}
          ],
          "returnType": "Promise<User>"
        }
      }
    ]
  }
]
```

## ⚙️ Configuration Options

```typescript
interface GeneratorOptions {
  includeLineNumbers?: boolean;    // Include position information
  maxDepth?: number;              // Limit nesting depth
  fileName?: string;              // File context for better analysis
  includePrivate?: boolean;       // Include private/internal members
  includeComments?: boolean;      // Include documentation/comments
  
  // Custom options for specific generators
  [key: string]: any;
}
```

## 🔧 Advanced Usage

### Custom Generators

Create your own generator for unsupported file types:

```typescript
import { OutlineGenerator, OutlineNode, GeneratorOptions } from 'document-outline-generator';

class SqlGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const nodes: OutlineNode[] = [];
    
    // Your parsing logic here
    const tables = this.extractTables(content);
    
    for (const table of tables) {
      const node = this.createNode(
        table.name,
        'table',
        1,
        table.position,
        { columns: table.columns }
      );
      nodes.push(node);
    }
    
    return nodes;
  }

  getSupportedExtensions(): string[] {
    return ['sql'];
  }
  
  private extractTables(content: string) {
    // Implementation here
    return [];
  }
}

// Register the custom generator
const generator = new DocumentOutlineGenerator();
generator.registerGenerator('sql', new SqlGenerator());
```

### Batch Processing

```typescript
import fs from 'fs/promises';
import path from 'path';

async function analyzeProject(projectPath: string) {
  const generator = new DocumentOutlineGenerator();
  const results = new Map();
  
  async function processDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await processDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1);
        
        if (generator.isSupported(ext)) {
          try {
            const outline = await generator.generateFromFile(fullPath);
            results.set(fullPath, outline);
          } catch (error) {
            console.warn(`Failed to process ${fullPath}:`, error);
          }
        }
      }
    }
  }
  
  await processDirectory(projectPath);
  return results;
}
```

## 🧪 Development

### Setup

```bash
git clone https://github.com/your-username/document-outline-generator.git
cd document-outline-generator
npm install
```

### Available Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode for development
npm test             # Run tests
npm run test:watch   # Watch mode for tests
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Project Structure

```
src/
├── index.ts                    # Main entry point
├── types.ts                    # TypeScript definitions
├── cli.ts                      # CLI implementation
├── generators/
│   ├── OutlineGenerator.ts     # Base generator class
│   ├── MarkdownGenerator.ts    # Markdown support
│   ├── JsonGenerator.ts        # JSON support
│   ├── XmlGenerator.ts         # XML support
│   ├── YamlGenerator.ts        # YAML support
│   ├── HtmlGenerator.ts        # HTML support
│   └── code/
│       ├── TypeScriptGenerator.ts  # TypeScript/JavaScript
│       ├── PythonGenerator.ts      # Python
│       ├── JavaGenerator.ts        # Java
│       └── CSharpGenerator.ts      # C#
tests/
├── DocumentOutlineGenerator.test.ts
└── fixtures/                   # Test files
```

### Adding New Language Support

1. Create a new generator in `src/generators/code/`
2. Extend the `OutlineGenerator` base class
3. Implement the `generate()` method
4. Register it in the main `DocumentOutlineGenerator` class
5. Add tests for the new generator

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Acorn](https://github.com/acornjs/acorn) for JavaScript/TypeScript parsing
- [Gray Matter](https://github.com/jonschlinkert/gray-matter) for frontmatter support
- [Cheerio](https://github.com/cheeriojs/cheerio) for HTML parsing
- [Fast XML Parser](https://github.com/NaturalIntelligence/fast-xml-parser) for XML support

## 🔗 Related Projects

- [markdown-toc](https://github.com/jonschlinkert/markdown-toc) - Generate table of contents for markdown files
- [json-schema-generator](https://github.com/krg7880/json-schema-generator) - Generate JSON schemas
- [tree-sitter](https://github.com/tree-sitter/tree-sitter) - Incremental parsing system

---

Made with ❤️ for better code analysis and documentation tools.