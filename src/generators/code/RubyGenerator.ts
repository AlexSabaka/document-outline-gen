import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Ruby outline generator. `def` methods nest under their class/module;
 * `def self.x` (singleton_method) is flagged static.
 */
export class RubyGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'ruby';
  protected classLikeKinds = new Set<string>(['class', 'module']);

  getSupportedExtensions(): string[] {
    return ['rb', 'rake', 'gemspec'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind !== 'function') {
      return undefined;
    }
    const meta: Record<string, unknown> = {
      parameters: this.parseParameters(def.defNode.childForFieldName('parameters')),
    };
    if (def.defNode.type === 'singleton_method') {
      meta.isStatic = true;
    }
    return meta;
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
        case 'optional_parameter': {
          const name = child.childForFieldName('name');
          const value = child.childForFieldName('value');
          out.push({ name: name?.text ?? child.text, optional: true, defaultValue: value?.text });
          break;
        }
        default:
          out.push({ name: child.text }); // splat, keyword, block params
      }
    }
    return out;
  }
}
