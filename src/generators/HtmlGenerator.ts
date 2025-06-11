import * as cheerio from 'cheerio';
import { GeneratorOptions, OutlineNode } from '../types';
import { OutlineGenerator } from './OutlineGenerator';

export class HtmlGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      const $ = cheerio.load(content);
      const nodes: OutlineNode[] = [];

      // Extract headings (h1-h6)
      $('h1, h2, h3, h4, h5, h6').each((_, element) => {
        const $el = $(element);
        const tagName = element.type.toLowerCase();
        const depth = parseInt(tagName.charAt(1));
        const title = $el.text().trim();
        const id = $el.attr('id');

        if (title) {
          const node = this.createNode(
            title,
            'heading',
            depth,
            undefined,
            {
              tagName,
              id: id || undefined,
              level: depth
            }
          );

          node.id = id || this.generateId(title, 'heading');
          node.anchor = id || this.createAnchor(title);

          nodes.push(node);
        }
      });

      // Extract semantic elements
      $('article, section, nav, aside, main, header, footer').each((_, element) => {
        const $el = $(element);
        const tagName = element.type.toLowerCase();
        const id = $el.attr('id');
        const className = $el.attr('class');
        const title = id || className || tagName;

        const node = this.createNode(
          title,
          'section',
          1,
          undefined,
          {
            tagName,
            id: id || undefined,
            className: className || undefined
          }
        );

        node.id = this.generateId(title, 'section');
        if (id) node.anchor = id;

        nodes.push(node);
      });

      const filteredNodes = this.filterByDepth(nodes, options.maxDepth);
      return this.buildHierarchy(filteredNodes.sort((a, b) => (a.line || 0) - (b.line || 0)));
    } catch (error) {
      throw new Error(`Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getSupportedExtensions(): string[] {
    return ['html', 'htm'];
  }
}