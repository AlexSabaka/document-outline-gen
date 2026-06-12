import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Lua outline generator. Functions (plain, local, and `M.foo` / `M:foo` table
 * functions) are top-level; Lua has no classes.
 */
export class LuaGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'lua';

  getSupportedExtensions(): string[] {
    return ['lua'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind !== 'function') {
      return undefined;
    }
    const meta: Record<string, unknown> = {
      parameters: this.parseParameters(def.defNode.childForFieldName('parameters')),
    };
    if (def.defNode.type === 'local_function_definition_statement') {
      meta.isLocal = true;
    }
    return meta;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'identifier') {
        out.push({ name: child.text });
      } else if (child.type === 'spread') {
        out.push({ name: '...' });
      }
    }
    return out;
  }
}
