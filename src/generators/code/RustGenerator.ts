import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Rust outline generator. Methods live inside `impl`/`trait` blocks and are
 * reclassified by the base. Visibility is set to `public` only for `pub` items
 * (Rust items are private by default).
 */
export class RustGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'rust';
  protected classLikeKinds = new Set<string>(['impl', 'trait']);

  getSupportedExtensions(): string[] {
    return ['rs'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'function': {
        const meta: Record<string, unknown> = {};
        if (this.isPublic(def.defNode)) {
          meta.visibility = 'public';
        }
        meta.parameters = this.parseParameters(def.defNode.childForFieldName('parameters'));
        const ret = def.defNode.childForFieldName('return_type');
        if (ret) {
          meta.returnType = ret.text;
        }
        return meta;
      }
      case 'field': {
        const meta: Record<string, unknown> = {};
        if (this.isPublic(def.defNode)) {
          meta.visibility = 'public';
        }
        const type = def.defNode.childForFieldName('type');
        if (type) {
          meta.dataType = type.text;
        }
        return Object.keys(meta).length > 0 ? meta : undefined;
      }
      case 'struct':
      case 'enum':
      case 'trait':
        return this.isPublic(def.defNode) ? { visibility: 'public' } : undefined;
      default:
        return undefined;
    }
  }

  private isPublic(node: Parser.SyntaxNode): boolean {
    return node.children.some((c) => c.type === 'visibility_modifier');
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const child of params.namedChildren) {
      if (child.type === 'self_parameter') {
        out.push({ name: child.text });
      } else if (child.type === 'parameter') {
        const pattern = child.childForFieldName('pattern');
        const type = child.childForFieldName('type');
        out.push({ name: pattern?.text ?? child.text, type: type?.text });
      }
    }
    return out;
  }
}
