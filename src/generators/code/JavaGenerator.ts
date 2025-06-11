import { GeneratorOptions, OutlineNode, CodeElement, Position } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

import { parse, createVisitor } from "java-ast";

interface JavaContext {
  elements: CodeElement[];
  content: string;
  lines: string[];
  currentPackage?: string;
  currentClass?: string;
  currentInterface?: string;
  currentEnum?: string;
}

export class JavaGenerator extends OutlineGenerator {
  async generate(
    content: string,
    options: GeneratorOptions = {}
  ): Promise<OutlineNode[]> {
    try {
      const elements = this.extractElements(content);
      return this.elementsToOutline(elements, options);
    } catch (error) {
      throw new Error(`Failed to parse Java code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractElements(content: string): CodeElement[] {
    const context: JavaContext = {
      elements: [],
      content,
      lines: content.split('\n'),
      currentPackage: undefined,
      currentClass: undefined,
      currentInterface: undefined,
      currentEnum: undefined
    };

    try {
      const ast = parse(content);

      const visitor = createVisitor({
        // Package declaration
        visitPackageDeclaration: (ctx) => {
          const packageName = this.extractPackageName(ctx);
          if (packageName) {
            context.currentPackage = packageName;
            const position = this.findPosition(context.lines, `package ${packageName}`);
            
            context.elements.push({
              name: packageName,
              type: 'package',
              visibility: 'public',
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Import declarations
        visitImportDeclaration: (ctx) => {
          const importName = this.extractImportName(ctx);
          if (importName) {
            const position = this.findPosition(context.lines, `import ${importName}`);
            
            context.elements.push({
              name: importName,
              type: 'import',
              visibility: 'public',
              position
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Class declarations
        visitClassDeclaration: (ctx) => {
          const className = this.extractIdentifier(ctx);
          if (className) {
            context.currentClass = className;
            const position = this.findPosition(context.lines, `class ${className}`) ||
                           this.findPosition(context.lines, `public class ${className}`) ||
                           this.findPosition(context.lines, `private class ${className}`) ||
                           this.findPosition(context.lines, `protected class ${className}`);
            
            const modifiers = this.extractModifiers(ctx);
            
            context.elements.push({
              name: className,
              type: 'class',
              visibility: this.extractVisibility(modifiers),
              isStatic: modifiers.includes('static'),
              isAbstract: modifiers.includes('abstract'),
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          
          const result = this.visitChildren(ctx, visitor);
          context.currentClass = undefined;
          return result;
        },

        // Interface declarations
        visitInterfaceDeclaration: (ctx) => {
          const interfaceName = this.extractIdentifier(ctx);
          if (interfaceName) {
            context.currentInterface = interfaceName;
            const position = this.findPosition(context.lines, `interface ${interfaceName}`) ||
                           this.findPosition(context.lines, `public interface ${interfaceName}`);
            
            const modifiers = this.extractModifiers(ctx);
            
            context.elements.push({
              name: interfaceName,
              type: 'interface',
              visibility: this.extractVisibility(modifiers),
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          
          const result = this.visitChildren(ctx, visitor);
          context.currentInterface = undefined;
          return result;
        },

        // Enum declarations
        visitEnumDeclaration: (ctx) => {
          const enumName = this.extractIdentifier(ctx);
          if (enumName) {
            context.currentEnum = enumName;
            const position = this.findPosition(context.lines, `enum ${enumName}`) ||
                           this.findPosition(context.lines, `public enum ${enumName}`);
            
            const modifiers = this.extractModifiers(ctx);
            
            context.elements.push({
              name: enumName,
              type: 'enum',
              visibility: this.extractVisibility(modifiers),
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          
          const result = this.visitChildren(ctx, visitor);
          context.currentEnum = undefined;
          return result;
        },

        // Enum constants
        visitEnumConstant: (ctx) => {
          const constantName = this.extractIdentifier(ctx);
          if (constantName && context.currentEnum) {
            const position = this.findPosition(context.lines, constantName);
            
            context.elements.push({
              name: constantName,
              type: 'enum-value',
              visibility: 'public',
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Method declarations
        visitMethodDeclaration: (ctx) => {
          const methodName = this.extractIdentifier(ctx);
          if (methodName) {
            const position = this.findPosition(context.lines, `${methodName}(`) ||
                           this.findPositionWithModifiers(context.lines, methodName);
            
            const modifiers = this.extractModifiers(ctx);
            const parameters = this.extractMethodParameters(ctx);
            const returnType = this.extractReturnType(ctx);
            
            // Determine if it's a constructor
            const isConstructor = methodName === context.currentClass;
            
            context.elements.push({
              name: methodName,
              type: isConstructor ? 'constructor' : 
                    context.currentInterface ? 'interface-method' : 'method',
              visibility: this.extractVisibility(modifiers),
              isStatic: modifiers.includes('static'),
              isAbstract: modifiers.includes('abstract'),
              parameters,
              returnType: isConstructor ? undefined : returnType,
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Field declarations
        visitFieldDeclaration: (ctx) => {
          const fieldNames = this.extractFieldNames(ctx);
          const modifiers = this.extractModifiers(ctx);
          const fieldType = this.extractFieldType(ctx);
          
          for (const fieldName of fieldNames) {
            const position = this.findPosition(context.lines, fieldName);
            
            context.elements.push({
              name: fieldName,
              type: 'field',
              visibility: this.extractVisibility(modifiers),
              isStatic: modifiers.includes('static'),
              returnType: fieldType,
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Annotation declarations
        visitAnnotationTypeDeclaration: (ctx) => {
          const annotationName = this.extractIdentifier(ctx);
          if (annotationName) {
            const position = this.findPosition(context.lines, `@interface ${annotationName}`);
            
            context.elements.push({
              name: annotationName,
              type: 'annotation',
              visibility: 'public',
              position,
              docstring: this.extractDocstring(context.lines, position?.line)
            });
          }
          return this.visitChildren(ctx, visitor);
        },

        // Default behavior for unhandled nodes
        defaultResult: () => "",
        aggregateResult: (a, b) => a + b,
      });

      visitor.visit(ast);
    } catch (error) {
      console.warn('Java AST parsing failed, falling back to regex parsing:', error);
      // Fallback to simple regex-based parsing
      return this.extractElementsWithRegex(content);
    }

    return context.elements;
  }

  private visitChildren(ctx: any, visitor: any): string {
    if (ctx.children) {
      return ctx.children.map((child: any) => visitor.visit(child)).join('');
    }
    return "";
  }

  private extractIdentifier(ctx: any): string | undefined {
    // Try different ways to extract identifier based on the context structure
    if (ctx.identifier && typeof ctx.identifier === 'function') {
      const identifier = ctx.identifier();
      return identifier?.text || identifier?.getText?.() || undefined;
    }
    if (ctx.IDENTIFIER && typeof ctx.IDENTIFIER === 'function') {
      const identifier = ctx.IDENTIFIER();
      return identifier?.text || identifier?.getText?.() || undefined;
    }
    if (ctx.getText && typeof ctx.getText === 'function') {
      const text = ctx.getText();
      const match = text.match(/\b([A-Za-z_][A-Za-z0-9_]*)\b/);
      return match?.[1];
    }
    return undefined;
  }

  private extractPackageName(ctx: any): string | undefined {
    if (ctx.qualifiedName && typeof ctx.qualifiedName === 'function') {
      const qualifiedName = ctx.qualifiedName();
      return qualifiedName?.text || qualifiedName?.getText?.();
    }
    return undefined;
  }

  private extractImportName(ctx: any): string | undefined {
    if (ctx.qualifiedName && typeof ctx.qualifiedName === 'function') {
      const qualifiedName = ctx.qualifiedName();
      return qualifiedName?.text || qualifiedName?.getText?.();
    }
    return undefined;
  }

  private extractModifiers(ctx: any): string[] {
    const modifiers: string[] = [];
    
    if (ctx.classModifier) {
      const classModifiers = Array.isArray(ctx.classModifier) ? ctx.classModifier : [ctx.classModifier];
      for (const modifier of classModifiers) {
        if (typeof modifier === 'function') {
          const mod = modifier();
          if (mod?.text) modifiers.push(mod.text);
        }
      }
    }
    
    if (ctx.modifier) {
      const methodModifiers = Array.isArray(ctx.modifier) ? ctx.modifier : [ctx.modifier];
      for (const modifier of methodModifiers) {
        if (typeof modifier === 'function') {
          const mod = modifier();
          if (mod?.text) modifiers.push(mod.text);
        }
      }
    }
    
    return modifiers;
  }

  private extractVisibility(modifiers: string[]): 'public' | 'private' | 'protected' | 'package' {
    if (modifiers.includes('private')) return 'private';
    if (modifiers.includes('protected')) return 'protected';
    if (modifiers.includes('public')) return 'public';
    return 'package'; // Package-private is default in Java
  }

  private extractMethodParameters(ctx: any): any[] {
    const parameters: any[] = [];
    
    if (ctx.formalParameterList && typeof ctx.formalParameterList === 'function') {
      const paramList = ctx.formalParameterList();
      if (paramList && paramList.formalParameter) {
        const params = Array.isArray(paramList.formalParameter) ? 
                      paramList.formalParameter : [paramList.formalParameter];
        
        for (const param of params) {
          if (typeof param === 'function') {
            const p = param();
            const name = this.extractIdentifier(p);
            const type = this.extractParameterType(p);
            if (name) {
              parameters.push({
                name,
                type: type || 'Object',
                optional: false
              });
            }
          }
        }
      }
    }
    
    return parameters;
  }

  private extractParameterType(ctx: any): string | undefined {
    if (ctx.typeType && typeof ctx.typeType === 'function') {
      const typeType = ctx.typeType();
      return typeType?.text || typeType?.getText?.();
    }
    return undefined;
  }

  private extractReturnType(ctx: any): string | undefined {
    if (ctx.typeTypeOrVoid && typeof ctx.typeTypeOrVoid === 'function') {
      const returnType = ctx.typeTypeOrVoid();
      return returnType?.text || returnType?.getText?.();
    }
    return 'void';
  }

  private extractFieldNames(ctx: any): string[] {
    const names: string[] = [];
    
    if (ctx.variableDeclarators && typeof ctx.variableDeclarators === 'function') {
      const declarators = ctx.variableDeclarators();
      if (declarators && declarators.variableDeclarator) {
        const vars = Array.isArray(declarators.variableDeclarator) ? 
                     declarators.variableDeclarator : [declarators.variableDeclarator];
        
        for (const variable of vars) {
          if (typeof variable === 'function') {
            const v = variable();
            const name = this.extractIdentifier(v);
            if (name) names.push(name);
          }
        }
      }
    }
    
    return names;
  }

  private extractFieldType(ctx: any): string | undefined {
    if (ctx.typeType && typeof ctx.typeType === 'function') {
      const typeType = ctx.typeType();
      return typeType?.text || typeType?.getText?.();
    }
    return 'Object';
  }

  private findPosition(lines: string[], searchText: string): Position | undefined {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(searchText)) {
        const column = line.indexOf(searchText) + 1;
        return { line: i + 1, column };
      }
    }
    return undefined;
  }

  private findPositionWithModifiers(lines: string[], methodName: string): Position | undefined {
    const patterns = [
      `public ${methodName}(`,
      `private ${methodName}(`,
      `protected ${methodName}(`,
      `static ${methodName}(`,
      `public static ${methodName}(`,
      `private static ${methodName}(`,
      `protected static ${methodName}(`
    ];
    
    for (const pattern of patterns) {
      const position = this.findPosition(lines, pattern);
      if (position) return position;
    }
    
    return this.findPosition(lines, `${methodName}(`);
  }

  private extractDocstring(lines: string[], lineNumber?: number): string | undefined {
    if (!lineNumber || lineNumber <= 1) return undefined;

    // Look for Javadoc comments (/** */) above the declaration
    let docLines: string[] = [];
    let currentIndex = lineNumber - 2;
    
    // Check if there's a Javadoc comment ending just before the declaration
    while (currentIndex >= 0) {
      const line = lines[currentIndex].trim();
      
      if (line.endsWith('*/')) {
        // Found end of comment, collect backwards
        docLines.unshift(line);
        currentIndex--;
        
        while (currentIndex >= 0) {
          const commentLine = lines[currentIndex].trim();
          docLines.unshift(commentLine);
          
          if (commentLine.startsWith('/**')) {
            return docLines.join('\n');
          }
          currentIndex--;
        }
        break;
      } else if (line.startsWith('//')) {
        // Single line comment
        return line;
      } else if (line === '') {
        // Skip empty lines
        currentIndex--;
      } else {
        // Found non-comment content, stop looking
        break;
      }
    }
    
    return undefined;
  }

  // Fallback regex-based parsing for when AST parsing fails
  private extractElementsWithRegex(content: string): CodeElement[] {
    const elements: CodeElement[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

      // Package declaration
      const packageMatch = line.match(/^package\s+([\w.]+);/);
      if (packageMatch) {
        elements.push({
          name: packageMatch[1],
          type: 'package',
          visibility: 'public',
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Class declaration
      const classMatch = line.match(/(?:public|private|protected)?\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/);
      if (classMatch) {
        elements.push({
          name: classMatch[1],
          type: 'class',
          visibility: this.extractVisibilityFromLine(line),
          isStatic: line.includes('static'),
          isAbstract: line.includes('abstract'),
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Interface declaration
      const interfaceMatch = line.match(/(?:public|private|protected)?\s*interface\s+(\w+)/);
      if (interfaceMatch) {
        elements.push({
          name: interfaceMatch[1],
          type: 'interface',
          visibility: this.extractVisibilityFromLine(line),
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Method declaration
      const methodMatch = line.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*[{;]/);
      if (methodMatch && !line.includes('class') && !line.includes('interface')) {
        elements.push({
          name: methodMatch[1],
          type: 'method',
          visibility: this.extractVisibilityFromLine(line),
          isStatic: line.includes('static'),
          position: { line: i + 1, column: 1 }
        });
      }
    }

    return elements;
  }

  private extractVisibilityFromLine(line: string): 'public' | 'private' | 'protected' | 'package' {
    if (line.includes('private')) return 'private';
    if (line.includes('protected')) return 'protected';
    if (line.includes('public')) return 'public';
    return 'package';
  }

  private elementsToOutline(
    elements: CodeElement[],
    options: GeneratorOptions
  ): OutlineNode[] {
    const nodes: OutlineNode[] = [];
    const containerNodes: Map<string, OutlineNode> = new Map();

    for (const element of elements) {
      const depth = this.getElementDepth(element);
      
      const node = this.createNode(
        element.name,
        element.type,
        depth,
        element.position,
        {
          visibility: element.visibility,
          isStatic: element.isStatic,
          isAbstract: element.isAbstract,
          parameters: element.parameters,
          returnType: element.returnType,
          docstring: element.docstring
        }
      );

      node.id = this.generateId(element.name, element.type, element.position?.line);

      // Handle hierarchical structure
      if (this.isContainer(element.type)) {
        containerNodes.set(element.name, node);
        nodes.push(node);
      } else {
        // Find appropriate parent container
        const parentContainer = this.findParentContainer(element, containerNodes);
        
        if (parentContainer) {
          if (!parentContainer.children) parentContainer.children = [];
          parentContainer.children.push(node);
        } else {
          nodes.push(node);
        }
      }
    }

    return this.filterByDepth(nodes, options.maxDepth);
  }

  private getElementDepth(element: CodeElement): number {
    const containerTypes = ['package', 'class', 'interface', 'enum', 'annotation'];
    return containerTypes.includes(element.type) ? 1 : 2;
  }

  private isContainer(type: string): boolean {
    return ['package', 'class', 'interface', 'enum', 'annotation'].includes(type);
  }

  private findParentContainer(element: CodeElement, containerNodes: Map<string, OutlineNode>): OutlineNode | undefined {
    if (!element.position) return undefined;

    let bestContainer: OutlineNode | undefined;
    let bestDistance = Infinity;

    for (const [name, container] of containerNodes.entries()) {
      if (container.line && element.position.line > container.line) {
        const distance = element.position.line - container.line;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestContainer = container;
        }
      }
    }

    return bestContainer;
  }

  getSupportedExtensions(): string[] {
    return ["java"];
  }
}