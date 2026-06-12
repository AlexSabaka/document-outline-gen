import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Scala outline generator. `def` methods (function_definition with a body,
 * function_declaration without) nest under class/object/trait.
 */
export class ScalaGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'scala';
  protected classLikeKinds = new Set<string>(['class', 'object', 'trait']);

  getSupportedExtensions(): string[] {
    return ['scala', 'sbt'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind !== 'function') {
      return undefined;
    }
    const meta: Record<string, unknown> = {};
    const visibility = this.visibility(def.defNode);
    if (visibility) {
      meta.visibility = visibility;
    }
    meta.parameters = this.parseParameters(def.defNode.childForFieldName('parameters'));
    const ret = def.defNode.childForFieldName('return_type');
    if (ret) {
      meta.returnType = ret.text;
    }
    return meta;
  }

  private visibility(node: Parser.SyntaxNode): string | undefined {
    const modifiers = node.children.find((c) => c.type === 'modifiers');
    const access = modifiers?.children.find((c) => c.type === 'access_modifier');
    return access?.text;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'parameter') {
        const name = child.childForFieldName('name');
        const type = child.childForFieldName('type');
        out.push({ name: name?.text ?? child.text, type: type?.text });
      }
    }
    return out;
  }
}
