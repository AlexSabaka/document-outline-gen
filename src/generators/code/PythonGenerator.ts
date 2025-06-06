import { GeneratorOptions, OutlineNode, CodeElement } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

export class PythonGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const lines = content.split('\n');
    const elements = this.extractElements(lines);
    return this.elementsToOutline(elements, options);
  }

  private extractElements(lines: string[]): CodeElement[] {
    const elements: CodeElement[] = [];
    const classStack: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const indentLevel = line.length - line.trimStart().length;

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      // Class definition
      const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
      if (classMatch) {
        const className = classMatch[1];
        elements.push({
          name: className,
          type: 'class',
          position: { line: i + 1, column: indentLevel + 1 },
          docstring: this.extractDocstring(lines, i + 1)
        });
        
        // Update class stack based on indentation
        while (classStack.length > indentLevel / 4) {
          classStack.pop();
        }
        classStack.push(className);
        continue;
      }

      // Function/method definition
      const funcMatch = trimmedLine.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const params = funcMatch[2];
        const isMethod = classStack.length > 0 && indentLevel > 0;

        elements.push({
          name: funcName,
          type: isMethod ? 'method' : 'function',
          parameters: this.parseParameters(params),
          visibility: this.getVisibility(funcName),
          position: { line: i + 1, column: indentLevel + 1 },
          docstring: this.extractDocstring(lines, i + 1)
        });
        continue;
      }

      // Variable assignment at class level
      if (classStack.length > 0) {
        const varMatch = trimmedLine.match(/^(\w+)\s*[:=]/);
        if (varMatch && !trimmedLine.includes('def ') && !trimmedLine.includes('class ')) {
          const varName = varMatch[1];
          elements.push({
            name: varName,
            type: 'property',
            visibility: this.getVisibility(varName),
            position: { line: i + 1, column: indentLevel + 1 }
          });
        }
      }

      // Update class stack based on indentation
      const currentClassLevel = Math.floor(indentLevel / 4);
      while (classStack.length > currentClassLevel) {
        classStack.pop();
      }
    }

    return elements;
  }

  private parseParameters(paramString: string): any[] {
    if (!paramString.trim()) return [];

    return paramString
      .split(',')
      .map(param => param.trim())
      .filter(param => param && param !== 'self' && param !== 'cls')
      .map(param => {
        const parts = param.split(':');
        const nameWithDefault = parts[0].trim();
        const type = parts[1]?.trim();

        if (nameWithDefault.includes('=')) {
          const [name, defaultValue] = nameWithDefault.split('=').map(p => p.trim());
          return {
            name: name.replace('*', ''),
            type,
            optional: true,
            defaultValue
          };
        }

        return {
          name: nameWithDefault.replace('*', ''),
          type,
          optional: nameWithDefault.startsWith('*')
        };
      });
  }

  private getVisibility(name: string): 'public' | 'private' | 'protected' {
    if (name.startsWith('__') && name.endsWith('__')) return 'public'; // Magic methods
    if (name.startsWith('__')) return 'private';
    if (name.startsWith('_')) return 'protected';
    return 'public';
  }

  private extractDocstring(lines: string[], startLine: number): string | undefined {
    if (startLine >= lines.length) return undefined;

    const nextLine = lines[startLine]?.trim();
    if (nextLine?.startsWith('"""') || nextLine?.startsWith("'''")) {
      return nextLine;
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
          visibility: element.visibility,
          parameters: element.parameters,
          docstring: element.docstring
        }
      );

      node.id = this.generateId(element.name, element.type, element.position?.line);

      if (element.type === 'class') {
        classNodes.set(element.name, node);
        nodes.push(node);
      } else if ((element.type === 'method' || element.type === 'property') && element.position) {
        // Find the appropriate parent class
        let parentClass: OutlineNode | undefined;
        for (const [, classNode] of classNodes.entries()) {
          if (classNode.line && element.position.line > classNode.line) {
            if (!parentClass || (parentClass.line && classNode.line > parentClass.line)) {
              parentClass = classNode;
            }
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
    return ['py'];
  }
}


