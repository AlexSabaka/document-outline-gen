import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * JavaScript / JSX outline generator (tree-sitter).
 *
 * Replaces the acorn parser. The `javascript` grammar handles JSX, so `.js`
 * and `.jsx` share it. No type annotations or access modifiers (those are TS).
 */
export class JavaScriptGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'javascript';

  getSupportedExtensions(): string[] {
    return ['js', 'jsx'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind === 'function') {
      return this.callableMetadata(def.defNode);
    }
    if (def.kind === 'property') {
      return this.hasModifier(def.defNode, 'static') ? { isStatic: true } : undefined;
    }
    return undefined;
  }

  private callableMetadata(node: Parser.SyntaxNode): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    if (this.hasModifier(node, 'static')) {
      meta.isStatic = true;
    }
    meta.parameters = this.parseParameters(this.callableNode(node).childForFieldName('parameters'));
    return meta;
  }

  /** For const/CommonJS forms, the callable is the assigned arrow/function. */
  private callableNode(node: Parser.SyntaxNode): Parser.SyntaxNode {
    if (node.type === 'lexical_declaration') {
      const declarator = node.namedChildren.find((c) => c.type === 'variable_declarator');
      return declarator?.childForFieldName('value') ?? node;
    }
    if (node.type === 'expression_statement') {
      const assign = node.namedChildren.find((c) => c.type === 'assignment_expression');
      return assign?.childForFieldName('right') ?? node;
    }
    return node;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      switch (child.type) {
        case 'identifier':
          out.push({ name: child.text });
          break;
        case 'assignment_pattern': {
          const left = child.childForFieldName('left');
          const right = child.childForFieldName('right');
          out.push({ name: left?.text ?? child.text, optional: true, defaultValue: right?.text });
          break;
        }
        default:
          // rest_pattern (...args), object/array destructuring, etc.
          out.push({ name: child.text });
      }
    }
    return out;
  }

  private hasModifier(node: Parser.SyntaxNode, keyword: string): boolean {
    return node.children.some((c) => c.type === keyword);
  }
}
