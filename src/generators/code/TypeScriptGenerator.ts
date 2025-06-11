import * as acorn from 'acorn';
import { tsPlugin } from 'acorn-typescript';

import { GeneratorOptions, OutlineNode, CodeElement } from '../../types';
import { OutlineGenerator } from '../OutlineGenerator';

const Parser = acorn.Parser.extend(tsPlugin() as any);

export class TypeScriptGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      // Parse TypeScript/JavaScript code
      const ast = Parser.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        // @ts-expect-error
        typescript: true
      });

      const elements = this.extractElements(ast, content);
      return this.elementsToOutline(elements, options);
    } catch (error) {
      throw new Error(`Failed to parse TypeScript code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractElements(node: any, content: string, elements: CodeElement[] = []): CodeElement[] {
    if (!node || typeof node !== 'object') return elements;

    const lines = content.split('\n');

    switch (node.type) {
      case 'ClassDeclaration':
        if (node.id?.name) {
          elements.push({
            name: node.id.name,
            type: 'class',
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'FunctionDeclaration':
        if (node.id?.name) {
          elements.push({
            name: node.id.name,
            type: 'function',
            parameters: this.extractParameters(node.params),
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'MethodDefinition':
        if (node.key?.name) {
          elements.push({
            name: node.key.name,
            type: 'method',
            visibility: this.getVisibility(node),
            isStatic: node.static || false,
            parameters: node.value?.params ? this.extractParameters(node.value.params) : [],
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'PropertyDefinition':
      case 'ClassProperty':
        if (node.key?.name) {
          elements.push({
            name: node.key.name,
            type: 'property',
            visibility: this.getVisibility(node),
            isStatic: node.static || false,
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined
          });
        }
        break;

      case 'TSInterfaceDeclaration':
        if (node.id?.name) {
          elements.push({
            name: node.id.name,
            type: 'interface',
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'TSTypeAliasDeclaration':
        if (node.id?.name) {
          elements.push({
            name: node.id.name,
            type: 'type',
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'TSEnumDeclaration':
        if (node.id?.name) {
          elements.push({
            name: node.id.name,
            type: 'enum',
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined,
            docstring: this.extractDocstring(node, lines)
          });
        }
        break;

      case 'VariableDeclaration':
        for (const declarator of node.declarations || []) {
          if (declarator.id?.name) {
            elements.push({
              name: declarator.id.name,
              type: 'variable',
              position: declarator.loc ? { line: declarator.loc.start.line, column: declarator.loc.start.column + 1 } : undefined
            });
          }
        }
        break;
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.extractElements(child, content, elements);
          }
        } else {
          this.extractElements(node[key], content, elements);
        }
      }
    }

    return elements;
  }

  private extractParameters(params: any[]): any[] {
    return params.map(param => {
      if (param.type === 'Identifier') {
        return { name: param.name };
      } else if (param.type === 'AssignmentPattern') {
        return {
          name: param.left.name,
          optional: true,
          defaultValue: 'default'
        };
      }
      return { name: 'unknown' };
    });
  }

  private getVisibility(node: any): 'public' | 'private' | 'protected' | undefined {
    if (node.accessibility) {
      return node.accessibility;
    }
    if (node.key?.name?.startsWith('_')) {
      return 'private';
    }
    return 'public';
  }

  private extractDocstring(node: any, lines: string[]): string | undefined {
    if (!node.loc) return undefined;

    const lineIndex = node.loc.start.line - 2; // Check line before declaration
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const prevLine = lines[lineIndex].trim();
      if (prevLine.startsWith('/**') || prevLine.startsWith('//')) {
        return prevLine;
      }
    }
    return undefined;
  }

  private elementsToOutline(elements: CodeElement[], options: GeneratorOptions): OutlineNode[] {
    const nodes: OutlineNode[] = [];
    const classNodes: Map<string, OutlineNode> = new Map();

    for (const element of elements) {
      const node = this.createNode(
        element.name,
        element.type,
        element.type === 'class' || element.type === 'interface' || element.type === 'enum' || element.type === 'type' ? 1 : 2,
        element.position,
        {
          visibility: element.visibility,
          isStatic: element.isStatic,
          parameters: element.parameters,
          returnType: element.returnType,
          docstring: element.docstring
        }
      );

      node.id = this.generateId(element.name, element.type, element.position?.line);

      if (element.type === 'class') {
        classNodes.set(element.name, node);
        nodes.push(node);
      } else if (element.type === 'method' || element.type === 'property') {
        // Try to find parent class (simplified approach)
        let parentClass: OutlineNode | undefined;
        for (const [className, classNode] of classNodes.entries()) {
          if (element.position && classNode.line && element.position.line > classNode.line) {
            parentClass = classNode;
          }
        }

        if (parentClass) {
          if (!parentClass.children) parentClass.children = [];
          parentClass.children.push(node);
        } else {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    return this.filterByDepth(nodes, options.maxDepth);
  }

  getSupportedExtensions(): string[] {
    return ['ts', 'tsx'];
  }
}