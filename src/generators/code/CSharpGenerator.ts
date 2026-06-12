import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';
import { DocStyle } from '../../docstrings';

/**
 * C# outline generator (tree-sitter).
 *
 * Replaces the @fluffy-spoon/csharp-parser. Modifiers are individual
 * `(modifier)` nodes (no wrapper); field types are nested in a
 * `variable_declaration`. Methods/constructors reclassify to methods inside a
 * class/struct/interface via the base.
 */
export class CSharpGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'c_sharp';
  protected readonly docStyle: DocStyle = 'xmldoc';

  // grammar is `c_sharp`, but the query lives under the conventional `csharp/`
  protected queryName(): string {
    return 'csharp';
  }

  getSupportedExtensions(): string[] {
    return ['cs'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function':
        return this.callableMetadata(def.defNode);
      case 'property':
        return this.typedMemberMetadata(def.defNode, def.defNode.childForFieldName('type'));
      case 'field':
        return this.fieldMetadata(def.defNode);
      case 'class':
      case 'struct':
      case 'interface':
      case 'enum':
        return this.modifierMetadata(def.defNode);
      default:
        return undefined; // namespace / enum-value
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
    const varDecl = node.namedChildren.find((c) => c.type === 'variable_declaration');
    return this.typedMemberMetadata(node, varDecl?.childForFieldName('type') ?? null);
  }

  private typedMemberMetadata(
    node: Parser.SyntaxNode,
    type: Parser.SyntaxNode | null,
  ): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = { ...(this.modifierMetadata(node) ?? {}) };
    if (type) {
      meta.dataType = type.text;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private modifierMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const modifiers = node.children.filter((c) => c.type === 'modifier').map((c) => c.text);
    const meta: Record<string, unknown> = {};
    for (const v of ['public', 'private', 'protected', 'internal']) {
      if (modifiers.includes(v)) {
        meta.visibility = v;
      }
    }
    if (modifiers.includes('static')) {
      meta.isStatic = true;
    }
    if (modifiers.includes('abstract')) {
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
      if (child.type !== 'parameter') {
        continue;
      }
      const type = child.childForFieldName('type');
      const name = child.childForFieldName('name');
      const param: Parameter = { name: name?.text ?? child.text };
      if (type) {
        param.type = type.text;
      }
      out.push(param);
    }
    return out;
  }
}
