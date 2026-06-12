import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Go outline generator. Methods are top-level (receiver-based), so they are
 * captured directly; struct fields and interface method specs nest under their
 * type. Visibility follows Go's exported-name convention (capitalized = public).
 */
export class GoGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'go';

  getSupportedExtensions(): string[] {
    return ['go'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    const name = def.nameNode?.text ?? '';
    switch (def.kind) {
      case 'function':
      case 'method': {
        const meta: Record<string, unknown> = { visibility: this.exported(name) };
        meta.parameters = this.parseParameters(def.defNode.childForFieldName('parameters'));
        const result = def.defNode.childForFieldName('result');
        if (result) {
          meta.returnType = result.text;
        }
        const receiver = def.defNode.childForFieldName('receiver');
        if (receiver) {
          meta.receiver = receiver.text;
        }
        return meta;
      }
      case 'field': {
        const meta: Record<string, unknown> = { visibility: this.exported(name) };
        const type = def.defNode.childForFieldName('type');
        if (type) {
          meta.dataType = type.text;
        }
        return meta;
      }
      case 'struct':
      case 'interface':
        return { visibility: this.exported(name) };
      default:
        return undefined;
    }
  }

  private exported(name: string): 'public' | 'private' {
    const first = name.charAt(0);
    return first && first === first.toUpperCase() && first !== first.toLowerCase()
      ? 'public'
      : 'private';
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'parameter_declaration') {
        const name = child.childForFieldName('name');
        const type = child.childForFieldName('type');
        out.push({ name: name?.text ?? '', type: type?.text });
      }
    }
    return out;
  }
}
