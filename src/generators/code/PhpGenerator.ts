import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { DocStyle } from '../../docstrings';
import { Parameter } from '../../types';

/**
 * PHP outline generator. Methods/functions, classes/interfaces/traits,
 * namespaces and properties; visibility from `visibility_modifier`.
 */
export class PhpGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'php';
  protected readonly docStyle: DocStyle = 'jsdoc'; // PHPDoc is jsdoc-shaped
  protected classLikeKinds = new Set<string>(['class', 'interface', 'trait']);

  getSupportedExtensions(): string[] {
    return ['php', 'phtml'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function': {
        const meta: Record<string, unknown> = {};
        const visibility = this.visibility(def.defNode);
        if (visibility) {
          meta.visibility = visibility;
        }
        if (this.hasModifier(def.defNode, 'static_modifier')) {
          meta.isStatic = true;
        }
        if (this.hasModifier(def.defNode, 'abstract_modifier')) {
          meta.isAbstract = true;
        }
        meta.parameters = this.parseParameters(def.defNode.childForFieldName('parameters'));
        const ret = def.defNode.childForFieldName('return_type');
        if (ret) {
          meta.returnType = ret.text;
        }
        return meta;
      }
      case 'property': {
        const meta: Record<string, unknown> = {};
        const visibility = this.visibility(def.defNode);
        if (visibility) {
          meta.visibility = visibility;
        }
        const type = def.defNode.childForFieldName('type');
        if (type) {
          meta.dataType = type.text;
        }
        return Object.keys(meta).length > 0 ? meta : undefined;
      }
      default:
        return undefined;
    }
  }

  private visibility(node: Parser.SyntaxNode): string | undefined {
    return node.children.find((c) => c.type === 'visibility_modifier')?.text;
  }

  private hasModifier(node: Parser.SyntaxNode, type: string): boolean {
    return node.children.some((c) => c.type === type);
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'simple_parameter' || child.type === 'variadic_parameter') {
        const name = child.childForFieldName('name');
        const type = child.childForFieldName('type');
        const value = child.childForFieldName('default_value');
        const param: Parameter = { name: name?.text ?? child.text };
        if (type) {
          param.type = type.text;
        }
        if (value) {
          param.optional = true;
          param.defaultValue = value.text;
        }
        out.push(param);
      }
    }
    return out;
  }
}
