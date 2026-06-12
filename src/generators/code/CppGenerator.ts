import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * C++ outline generator.
 *
 * Structure comes from `queries/cpp/outline.scm` over the tree-sitter-cpp
 * grammar; this subclass adds member metadata — parameters, return types,
 * visibility (from the enclosing `access_specifier`, default private for class /
 * public for struct), static and virtual flags — to match the other languages.
 */
export class CppGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'cpp';

  getSupportedExtensions(): string[] {
    return ['cpp'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function':
        return this.callableMetadata(def.defNode);
      case 'field':
        return this.fieldMetadata(def.defNode);
      default:
        return undefined; // namespace / class / struct / enum / union / include
    }
  }

  private callableMetadata(node: Parser.SyntaxNode): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    const visibility = this.visibility(node);
    if (visibility) {
      meta.visibility = visibility;
    }
    if (this.hasChild(node, 'storage_class_specifier', 'static')) {
      meta.isStatic = true;
    }
    if (this.hasChild(node, 'virtual')) {
      meta.isVirtual = true;
    }
    const declarator = this.functionDeclarator(node);
    meta.parameters = this.parseParameters(declarator?.childForFieldName('parameters') ?? null);
    const returnType = node.childForFieldName('type'); // constructors/destructors have none
    if (returnType) {
      meta.returnType = returnType.text;
    }
    return meta;
  }

  private fieldMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    const visibility = this.visibility(node);
    if (visibility) {
      meta.visibility = visibility;
    }
    if (this.hasChild(node, 'storage_class_specifier', 'static')) {
      meta.isStatic = true;
    }
    const type = node.childForFieldName('type');
    if (type) {
      meta.dataType = type.text;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  /** Visibility from the nearest preceding access_specifier, else by container. */
  private visibility(node: Parser.SyntaxNode): string | undefined {
    let sibling = node.previousSibling;
    while (sibling) {
      if (sibling.type === 'access_specifier') {
        return sibling.text.replace(/:$/, '');
      }
      sibling = sibling.previousSibling;
    }
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'struct_specifier') {
        return 'public';
      }
      if (parent.type === 'class_specifier') {
        return 'private';
      }
      parent = parent.parent;
    }
    return undefined; // free function — no access level
  }

  /** Unwrap pointer/reference declarators down to the function_declarator. */
  private functionDeclarator(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let declarator = node.childForFieldName('declarator');
    while (declarator && declarator.type !== 'function_declarator') {
      const inner = declarator.childForFieldName('declarator');
      if (!inner) {
        return null;
      }
      declarator = inner;
    }
    return declarator;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type !== 'parameter_declaration') {
        continue;
      }
      const type = child.childForFieldName('type');
      const declarator = child.childForFieldName('declarator');
      const param: Parameter = { name: declarator?.text ?? '' };
      if (type) {
        param.type = type.text;
      }
      out.push(param);
    }
    return out;
  }

  private hasChild(node: Parser.SyntaxNode, type: string, text?: string): boolean {
    return node.children.some((c) => c.type === type && (text === undefined || c.text === text));
  }
}
