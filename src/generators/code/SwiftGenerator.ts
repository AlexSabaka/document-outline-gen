import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

const TYPE_KEYWORDS = ['struct', 'enum', 'extension', 'actor', 'class'];

/**
 * Swift outline generator. class/struct/enum/extension all parse as
 * `class_declaration` distinguished by a leading keyword; the grammar labels
 * many things `name:` (including return types), so types are read positionally.
 */
export class SwiftGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'swift';
  protected classLikeKinds = new Set<string>(['class', 'protocol']);

  getSupportedExtensions(): string[] {
    return ['swift'];
  }

  protected mapKindToType(kind: string, node: Parser.SyntaxNode): string {
    if (kind === 'class') {
      const keyword = node.children.find((c) => TYPE_KEYWORDS.includes(c.type));
      if (keyword) {
        return keyword.type;
      }
    }
    return kind;
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind === 'function') {
      const meta: Record<string, unknown> = {};
      const visibility = this.visibility(def.defNode);
      if (visibility) {
        meta.visibility = visibility;
      }
      if (this.isStatic(def.defNode)) {
        meta.isStatic = true;
      }
      meta.parameters = this.parseParameters(def.defNode);
      // The return type is the function's own direct user_type child.
      const ret = def.defNode.children.find((c) => c.type === 'user_type');
      if (ret) {
        meta.returnType = ret.text;
      }
      return meta;
    }
    if (def.kind === 'property') {
      const annotation = def.defNode.children.find((c) => c.type === 'type_annotation');
      const type = annotation?.children.find((c) => c.type === 'user_type');
      return type ? { dataType: type.text } : undefined;
    }
    return undefined;
  }

  private visibility(node: Parser.SyntaxNode): string | undefined {
    const modifiers = node.children.find((c) => c.type === 'modifiers');
    return modifiers?.children.find((c) => c.type === 'visibility_modifier')?.text;
  }

  private isStatic(node: Parser.SyntaxNode): boolean {
    const modifiers = node.children.find((c) => c.type === 'modifiers');
    return modifiers?.children.some((c) => c.text === 'static') ?? false;
  }

  private parseParameters(node: Parser.SyntaxNode): Parameter[] {
    const out: Parameter[] = [];
    for (const child of node.children) {
      if (child.type === 'parameter') {
        const name = child.children.find((c) => c.type === 'simple_identifier');
        const type = child.children.find((c) => c.type === 'user_type');
        out.push({ name: name?.text ?? '', type: type?.text });
      }
    }
    return out;
  }
}
