import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';
import { DocStyle } from '../../docstrings';

/**
 * Java outline generator (tree-sitter).
 *
 * Replaces the java-ast (ANTLR) parser. Visibility/static/abstract come from
 * the `(modifiers)` node; methods and constructors are reclassified to methods
 * inside a class/interface by the base.
 */
export class JavaGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'java';
  protected readonly docStyle: DocStyle = 'javadoc';

  getSupportedExtensions(): string[] {
    return ['java'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function':
        return this.callableMetadata(def.defNode);
      case 'field':
        return this.fieldMetadata(def.defNode);
      case 'class':
      case 'interface':
      case 'enum':
      case 'annotation':
        return this.modifierMetadata(def.defNode);
      default:
        return undefined; // package / import / enum-value
    }
  }

  private callableMetadata(node: Parser.SyntaxNode): Record<string, unknown> {
    const meta: Record<string, unknown> = { ...(this.modifierMetadata(node) ?? {}) };
    meta.parameters = this.parseParameters(node.childForFieldName('parameters'));
    const returnType = node.childForFieldName('type'); // constructors have none
    if (returnType) {
      meta.returnType = returnType.text;
    }
    const typeParams = node.childForFieldName('type_parameters');
    if (typeParams) {
      meta.typeParameters = typeParams.text;
    }
    return meta;
  }

  private fieldMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = { ...(this.modifierMetadata(node) ?? {}) };
    const type = node.childForFieldName('type');
    if (type) {
      meta.dataType = type.text;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private modifierMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const modifiers = node.children.find((c) => c.type === 'modifiers');
    if (!modifiers) {
      return undefined;
    }
    const kinds = new Set(modifiers.children.map((c) => c.type));
    const meta: Record<string, unknown> = {};
    for (const v of ['public', 'private', 'protected']) {
      if (kinds.has(v)) {
        meta.visibility = v;
      }
    }
    if (kinds.has('static')) {
      meta.isStatic = true;
    }
    if (kinds.has('abstract')) {
      meta.isAbstract = true;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'formal_parameter') {
        const type = child.childForFieldName('type');
        const name = child.childForFieldName('name');
        const param: Parameter = { name: name?.text ?? child.text };
        if (type) {
          param.type = type.text;
        }
        out.push(param);
      } else if (child.type === 'spread_parameter') {
        out.push({ name: child.text });
      }
    }
    return out;
  }
}
