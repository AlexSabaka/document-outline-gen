import Parser from 'web-tree-sitter';
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { Parameter } from '../../types';

/**
 * Python outline generator (tree-sitter).
 *
 * Replaces the former line-by-line regex parser. Structure (classes, methods,
 * functions, class attributes) comes from `queries/python/outline.scm`; this
 * subclass adds Python-specific metadata: name-based visibility, typed
 * parameters with defaults, return types, async flag, base classes, docstrings.
 */
export class PythonGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'python';

  getSupportedExtensions(): string[] {
    return ['py'];
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    switch (def.kind) {
      case 'class':
        return this.classMetadata(def.defNode);
      case 'function':
        return this.functionMetadata(def);
      case 'property':
        return this.propertyMetadata(def);
      default:
        return undefined;
    }
  }

  private classMetadata(node: Parser.SyntaxNode): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    const doc = this.docstring(node.childForFieldName('body'));
    if (doc) {
      meta.docstring = doc;
    }
    const supers = node.childForFieldName('superclasses');
    if (supers) {
      const bases = supers.namedChildren.map((c) => c.text);
      if (bases.length > 0) {
        meta.bases = bases;
      }
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private functionMetadata(def: DefinitionCapture): Record<string, unknown> {
    const node = def.defNode;
    const meta: Record<string, unknown> = {
      visibility: this.visibility(def.nameNode?.text ?? ''),
      parameters: this.parseParameters(node.childForFieldName('parameters')),
    };
    const ret = node.childForFieldName('return_type');
    if (ret) {
      meta.returnType = ret.text;
    }
    if (node.text.startsWith('async')) {
      meta.isAsync = true;
    }
    return meta;
  }

  private propertyMetadata(def: DefinitionCapture): Record<string, unknown> {
    const meta: Record<string, unknown> = {
      visibility: this.visibility(def.nameNode?.text ?? ''),
    };
    const type = def.defNode.childForFieldName('type');
    if (type) {
      meta.dataType = type.text;
    }
    return meta;
  }

  private parseParameters(params: Parser.SyntaxNode | null): Parameter[] {
    if (!params) {
      return [];
    }
    const result: Parameter[] = [];
    for (const child of params.namedChildren) {
      const param = this.paramFrom(child);
      if (param && param.name !== 'self' && param.name !== 'cls') {
        result.push(param);
      }
    }
    return result;
  }

  private paramFrom(node: Parser.SyntaxNode): Parameter | null {
    switch (node.type) {
      case 'identifier':
        return { name: node.text };
      case 'typed_parameter': {
        const id = node.namedChildren.find((c) => c.type === 'identifier');
        const type = node.childForFieldName('type');
        return { name: id?.text ?? node.text, type: type?.text };
      }
      case 'default_parameter': {
        const name = node.childForFieldName('name');
        const value = node.childForFieldName('value');
        return { name: name?.text ?? '', optional: true, defaultValue: value?.text };
      }
      case 'typed_default_parameter': {
        const name = node.childForFieldName('name');
        const type = node.childForFieldName('type');
        const value = node.childForFieldName('value');
        return { name: name?.text ?? '', type: type?.text, optional: true, defaultValue: value?.text };
      }
      case 'list_splat_pattern':
        return { name: `*${node.namedChildren[0]?.text ?? ''}` };
      case 'dictionary_splat_pattern':
        return { name: `**${node.namedChildren[0]?.text ?? ''}` };
      default:
        return { name: node.text };
    }
  }

  private visibility(name: string): 'public' | 'private' | 'protected' {
    if (name.startsWith('__') && name.endsWith('__')) {
      return 'public'; // dunder / magic methods
    }
    if (name.startsWith('__')) {
      return 'private';
    }
    if (name.startsWith('_')) {
      return 'protected';
    }
    return 'public';
  }

  private docstring(body: Parser.SyntaxNode | null): string | undefined {
    if (!body) {
      return undefined;
    }
    const first = body.namedChildren[0];
    if (first?.type === 'expression_statement') {
      const expr = first.namedChildren[0];
      if (expr?.type === 'string') {
        return expr.text;
      }
    }
    return undefined;
  }
}
