import * as acorn from 'acorn';
import { GeneratorOptions, OutlineNode, CodeElement } from '../../types';
import { OutlineGenerator } from '../OutlineGenerator';

export class JavaScriptGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      // Parse JavaScript code
      const ast = acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      });

      const elements = this.extractElements(ast, content);
      return this.elementsToOutline(elements, options);
    } catch (error) {
      throw new Error(`Failed to parse JavaScript code: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        // Handle function expressions assigned to variables
        if (node.parent?.type === 'VariableDeclarator' && node.parent.id?.name) {
          elements.push({
            name: node.parent.id.name,
            type: 'function',
            parameters: this.extractParameters(node.params),
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined
          });
        }
        break;

      case 'MethodDefinition':
        if (node.key?.name) {
          elements.push({
            name: node.key.name,
            type: 'method',
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
            isStatic: node.static || false,
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined
          });
        }
        break;

      // case 'VariableDeclaration':
      //   for (const declarator of node.declarations || []) {
      //     if (declarator.id?.name) {
      //       // Check if it's a function assignment
      //       const isFunctionAssignment = declarator.init && 
      //         (declarator.init.type === 'FunctionExpression' || declarator.init.type === 'ArrowFunctionExpression');
            
      //       elements.push({
      //         name: declarator.id.name,
      //         type: isFunctionAssignment ? 'function' : 'variable',
      //         parameters: isFunctionAssignment ? this.extractParameters(declarator.init.params || []) : undefined,
      //         position: declarator.loc ? { line: declarator.loc.start.line, column: declarator.loc.start.column + 1 } : undefined
      //       });
      //     }
      //   }
      //   break;

      case 'AssignmentExpression':
        // Handle prototype assignments and object method assignments
        if (node.left?.type === 'MemberExpression' && node.left.property?.name) {
          const isFunctionAssignment = node.right && 
            (node.right.type === 'FunctionExpression' || node.right.type === 'ArrowFunctionExpression');
          
          elements.push({
            name: node.left.property.name,
            type: isFunctionAssignment ? 'method' : 'property',
            parameters: isFunctionAssignment ? this.extractParameters(node.right.params || []) : undefined,
            position: node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined
          });
        }
        break;
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (key !== 'parent' && node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            if (child && typeof child === 'object') {
              child.parent = node; // Set parent reference for context
            }
            this.extractElements(child, content, elements);
          }
        } else {
          if (node[key] && typeof node[key] === 'object') {
            node[key].parent = node; // Set parent reference for context
          }
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
      } else if (param.type === 'RestElement') {
        return {
          name: `...${param.argument.name}`,
          optional: true
        };
      }
      return { name: 'unknown' };
    });
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
        element.type === 'class' ? 1 : 2,
        element.position,
        {
          isStatic: element.isStatic,
          parameters: element.parameters,
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
    return ['js', 'jsx'];
  }
}