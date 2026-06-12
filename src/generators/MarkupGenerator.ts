import { OutlineGenerator } from './OutlineGenerator';
import { GeneratorOptions, OutlineNode } from '../types';

/**
 * A parsed markup element. `isSection` items (headings/sections) form the depth
 * hierarchy; everything else (directives, environments, code blocks) attaches as
 * a non-pushing leaf under the current section.
 */
export interface MarkupItem {
  title: string;
  type: string;
  isSection: boolean;
  /** 1-based depth for sections; ignored for blocks (computed at assembly). */
  depth?: number;
  line: number;
  metadata?: Record<string, unknown>;
}

/**
 * Shared base for the hand-written markup parsers (RST, AsciiDoc, LaTeX, Org,
 * Wiki). Subclasses only describe how to turn content into a flat
 * {@link MarkupItem} list; the base assembles the tree.
 *
 * No tree-sitter grammar ships for these formats under the pinned runtime, and
 * markup is line-oriented anyway, so each parser is a small regex pass — the
 * same shape as {@link MarkdownGenerator}.
 */
export abstract class MarkupGenerator extends OutlineGenerator {
  protected abstract parseItems(content: string, options: GeneratorOptions): MarkupItem[];

  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const items = this.parseItems(content, options).sort((a, b) => a.line - b.line);
    return this.filterByDepth(this.assemble(items), options.maxDepth);
  }

  /**
   * Build the outline. Sections push onto a stack and nest by depth; blocks
   * attach to the innermost open section as leaves without becoming parents
   * themselves (so a later heading can't accidentally nest under a block).
   */
  private assemble(items: MarkupItem[]): OutlineNode[] {
    const roots: OutlineNode[] = [];
    const stack: OutlineNode[] = [];

    for (const item of items) {
      if (item.isSection) {
        const depth = item.depth ?? 1;
        while (stack.length && stack[stack.length - 1].depth >= depth) {
          stack.pop();
        }
        const node = this.makeNode(item, depth);
        node.anchor = this.createAnchor(item.title);
        (stack.length ? stack[stack.length - 1].children! : roots).push(node);
        stack.push(node);
      } else {
        const parent = stack.length ? stack[stack.length - 1] : null;
        const node = this.makeNode(item, parent ? parent.depth + 1 : 1);
        (parent ? parent.children! : roots).push(node);
      }
    }
    return roots;
  }

  private makeNode(item: MarkupItem, depth: number): OutlineNode {
    const node = this.createNode(
      item.title,
      item.type,
      depth,
      { line: item.line, column: 1 },
      item.metadata && Object.keys(item.metadata).length > 0 ? item.metadata : undefined,
    );
    node.id = this.generateId(item.title, item.type, item.line);
    return node;
  }
}
