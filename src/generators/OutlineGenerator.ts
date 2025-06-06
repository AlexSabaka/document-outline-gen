import { OutlineNode, GeneratorOptions, Position } from '../types';

/**
 * Base abstract class for all outline generators
 */
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
  ): OutlineNode {
    const node: OutlineNode = {
      title,
      type,
      depth,
      children: []
    };

    if (position) {
      node.line = position.line;
      node.column = position.column;
    }

    if (metadata) {
      node.metadata = metadata;
    }

    return node;
  }

  /**
   * Utility method to generate unique ID for a node
   */
  protected generateId(title: string, type: string, line?: number): string {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const suffix = line ? `-${line}` : '';
    return `${type}-${cleanTitle}${suffix}`;
  }

  /**
   * Utility method to create anchor from title
   */
  protected createAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Utility method to build hierarchical structure from flat list
   */
  protected buildHierarchy(nodes: OutlineNode[]): OutlineNode[] {
    const result: OutlineNode[] = [];
    const stack: OutlineNode[] = [];

    for (const node of nodes) {
      // Find the correct parent in the stack
      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top-level node
        result.push(node);
      } else {
        // Child node
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      }

      stack.push(node);
    }

    return result;
  }

  /**
   * Utility method to count lines and get position
   */
  protected getPosition(content: string, index: number): Position {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  /**
   * Utility method to filter nodes by depth
   */
  protected filterByDepth(nodes: OutlineNode[], maxDepth?: number): OutlineNode[] {
    if (!maxDepth) return nodes;

    return nodes
      .filter(node => node.depth <= maxDepth)
      .map(node => ({
        ...node,
        children: node.children ? this.filterByDepth(node.children, maxDepth) : undefined
      }));
  }
}