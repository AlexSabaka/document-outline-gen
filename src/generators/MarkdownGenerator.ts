import { OutlineGenerator } from './OutlineGenerator';
import { OutlineNode, GeneratorOptions } from '../types';
import matter from 'gray-matter';

import Parser from "tree-sitter";
import Markdown from "tree-sitter-markdown";

// const p = new Parser();
// console.log(Markdown);
// p.setLanguage(Markdown as Parser.Language);

export class MarkdownGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    // Parse frontmatter if present
    const { content: markdownContent, data: frontmatter } = matter(content);
    
    const nodes: OutlineNode[] = [];
    const lines = markdownContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        const [, hashes, title] = headingMatch;
        const depth = hashes.length;
        const cleanTitle = title.trim();
        
        const node = this.createNode(
          cleanTitle,
          'heading',
          depth,
          options.includeLineNumbers ? { line: i + 1, column: 1 } : undefined,
          {
            level: depth,
            rawTitle: title,
            frontmatter: i === 0 && Object.keys(frontmatter).length > 0 ? frontmatter : undefined
          }
        );
        
        node.id = this.generateId(cleanTitle, 'heading', i + 1);
        node.anchor = this.createAnchor(cleanTitle);
        
        nodes.push(node);
      }
    }
    
    // Apply depth filtering if specified
    const filteredNodes = this.filterByDepth(nodes, options.maxDepth);
    
    // Build hierarchical structure
    return this.buildHierarchy(filteredNodes);
  }

  getSupportedExtensions(): string[] {
    return ['md', 'markdown'];
  }
}