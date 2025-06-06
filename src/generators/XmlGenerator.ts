import { OutlineGenerator } from './OutlineGenerator';
import { OutlineNode, GeneratorOptions } from '../types';
import { XMLParser } from 'fast-xml-parser';

export class XmlGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseTagValue: false,
        trimValues: true
      });

      const xmlData = parser.parse(content);
      return this.xmlToOutline(xmlData, options);
    } catch (error) {
      throw new Error(`Invalid XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private xmlToOutline(data: any, options: GeneratorOptions, depth: number = 1, parentPath: string = ''): OutlineNode[] {
    const nodes: OutlineNode[] = [];

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('@_')) continue; // Skip attributes for now

        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        const hasChildren = typeof value === 'object' && value !== null && !Array.isArray(value);
        const isArray = Array.isArray(value);

        const node = this.createNode(
          key,
          isArray ? 'array' : hasChildren ? 'element' : 'text',
          depth,
          undefined,
          {
            path: currentPath,
            hasAttributes: this.hasAttributes(value),
            isArray,
            textContent: typeof value === 'string' ? value : undefined
          }
        );

        node.id = this.generateId(key, node.type);

        if (hasChildren && !isArray) {
          node.children = this.xmlToOutline(value, options, depth + 1, currentPath);
        } else if (isArray) {
          // Handle array of elements
          for (let i = 0; i < Math.min(value.length, 3); i++) { // Show first 3 items
            const arrayItem = value[i];
            if (typeof arrayItem === 'object') {
              const itemNodes = this.xmlToOutline(arrayItem, options, depth + 1, `${currentPath}[${i}]`);
              if (!node.children) node.children = [];
              node.children.push(...itemNodes);
            }
          }
        }

        nodes.push(node);
      }
    }

    return this.filterByDepth(nodes, options.maxDepth);
  }

  private hasAttributes(value: any): boolean {
    if (typeof value !== 'object' || value === null) return false;
    return Object.keys(value).some(key => key.startsWith('@_'));
  }

  getSupportedExtensions(): string[] {
    return ['xml'];
  }
}
