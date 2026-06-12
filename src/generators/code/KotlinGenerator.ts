import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Kotlin outline generator. Interfaces parse as `class_declaration` with an
 * `interface` keyword; objects are `object_declaration`. Names are positional
 * children (no `name:` field).
 */
export class KotlinGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'kotlin';
  protected classLikeKinds = new Set<string>(['class', 'interface', 'object']);

  getSupportedExtensions(): string[] {
    return ['kt', 'kts'];
  }

  protected mapKindToType(kind: string, node: Parser.SyntaxNode): string {
    if (kind === 'class' && node.children.some((c) => c.type === 'interface')) {
      return 'interface';
    }
    return kind;
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    const mods = this.modifierInfo(def.defNode);
    if (def.kind === 'function') {
      const meta: Record<string, unknown> = { ...mods };
      meta.parameters = this.parseParameters(def.defNode);
      const ret = this.returnType(def.defNode);
      if (ret) {
        meta.returnType = ret;
      }
      return meta;
    }
    if (def.kind === 'property' || def.kind === 'class') {
      return Object.keys(mods).length > 0 ? mods : undefined;
    }
    return undefined;
  }

  private modifierInfo(node: Parser.SyntaxNode): Record<string, unknown> {
    const modifiers = node.children.find((c) => c.type === 'modifiers');
    const info: Record<string, unknown> = {};
    if (modifiers) {
      for (const m of modifiers.children) {
        if (m.type === 'visibility_modifier') {
          info.visibility = m.text;
        }
        if (m.type === 'inheritance_modifier' && m.text === 'abstract') {
          info.isAbstract = true;
        }
      }
    }
    return info;
  }

  private parseParameters(node: Parser.SyntaxNode): Parameter[] {
    const params = node.children.find((c) => c.type === 'function_value_parameters');
    if (!params) {
      return [];
    }
    const out: Parameter[] = [];
    for (const p of params.namedChildren) {
      if (p.type === 'parameter') {
        const name = p.children.find((c) => c.type === 'simple_identifier');
        const type = p.children.find((c) => c.type === 'user_type');
        out.push({ name: name?.text ?? '', type: type?.text });
      }
    }
    return out;
  }

  private returnType(node: Parser.SyntaxNode): string | undefined {
    const children = node.children;
    const start = children.findIndex((c) => c.type === 'function_value_parameters');
    for (let i = start + 1; i < children.length; i++) {
      if (children[i].type === 'function_body') {
        break;
      }
      if (children[i].type === 'user_type') {
        return children[i].text;
      }
    }
    return undefined;
  }
}
