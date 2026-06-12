import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * TypeScript / TSX outline generator (tree-sitter).
 *
 * Replaces the acorn + acorn-typescript parser. One instance is registered per
 * grammar — `typescript` for `.ts`, `tsx` for `.tsx` — both sharing
 * `queries/typescript/outline.scm` (every typescript node type also exists in
 * the tsx grammar, so one query compiles against both).
 */
export class TypeScriptGenerator extends TreeSitterGenerator {
  constructor(protected readonly grammarName: string = 'typescript') {
    super();
  }

  protected queryName(): string {
    return 'typescript';
  }

  getSupportedExtensions(): string[] {
    return this.grammarName === 'tsx' ? ['tsx'] : ['ts'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function':
        return this.callableMetadata(def.defNode);
      case 'property':
        return this.propertyMetadata(def.defNode);
      case 'class':
        return this.classMetadata(def.defNode);
      default:
        return undefined; // interface / type / enum are leaves here
    }
  }

  private classMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    if (node.type === 'abstract_class_declaration') {
      meta.isAbstract = true;
    }
    const typeParams = node.childForFieldName('type_parameters');
    if (typeParams) {
      meta.typeParameters = typeParams.text;
    }
    const decorators = this.decorators(node);
    if (decorators.length > 0) {
      meta.decorators = decorators;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private callableMetadata(node: Parser.SyntaxNode): Record<string, unknown> {
    const callable = this.callableNode(node);
    const meta: Record<string, unknown> = {};
    const visibility = this.visibility(node);
    if (visibility) {
      meta.visibility = visibility;
    }
    if (this.hasModifier(node, 'static')) {
      meta.isStatic = true;
    }
    if (node.type === 'abstract_method_signature' || this.hasModifier(node, 'abstract')) {
      meta.isAbstract = true;
    }
    meta.parameters = this.parseParameters(callable.childForFieldName('parameters'));
    const ret = callable.childForFieldName('return_type');
    if (ret) {
      meta.returnType = this.typeText(ret);
    }
    const decorators = this.decorators(node);
    if (decorators.length > 0) {
      meta.decorators = decorators;
    }
    return meta;
  }

  private propertyMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    const visibility = this.visibility(node);
    if (visibility) {
      meta.visibility = visibility;
    }
    if (this.hasModifier(node, 'static')) {
      meta.isStatic = true;
    }
    const type = node.childForFieldName('type');
    if (type) {
      meta.dataType = this.typeText(type);
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  /** For `const f = () => {}`, the callable is the arrow/function value. */
  private callableNode(node: Parser.SyntaxNode): Parser.SyntaxNode {
    if (node.type === 'lexical_declaration') {
      const declarator = node.namedChildren.find((c) => c.type === 'variable_declarator');
      return declarator?.childForFieldName('value') ?? node;
    }
    return node;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type !== 'required_parameter' && child.type !== 'optional_parameter') {
        continue;
      }
      const pattern = child.childForFieldName('pattern');
      const type = child.childForFieldName('type');
      const value = child.childForFieldName('value');
      const param: Parameter = { name: pattern?.text ?? child.text };
      if (type) {
        param.type = this.typeText(type);
      }
      if (child.type === 'optional_parameter' || value) {
        param.optional = true;
      }
      if (value) {
        param.defaultValue = value.text;
      }
      out.push(param);
    }
    return out;
  }

  private visibility(node: Parser.SyntaxNode): string | undefined {
    const modifier = node.children.find((c) => c.type === 'accessibility_modifier');
    return modifier?.text;
  }

  private hasModifier(node: Parser.SyntaxNode, keyword: string): boolean {
    return node.children.some((c) => c.type === keyword);
  }

  private decorators(node: Parser.SyntaxNode): string[] {
    const result: string[] = [];
    const collect = (n: Parser.SyntaxNode) => {
      for (const c of n.children) {
        if (c.type === 'decorator') {
          result.push(c.text);
        }
      }
    };
    collect(node);
    if (node.parent?.type === 'export_statement') {
      collect(node.parent);
    }
    return result;
  }

  /** Strip the leading `: ` from a type_annotation / return type node. */
  private typeText(node: Parser.SyntaxNode): string {
    return node.text.replace(/^:\s*/, '');
  }
}
