import { GeneratorOptions, OutlineNode, CodeElement, Position } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

// Tree-sitter imports
import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';

interface CppContext {
  elements: CodeElement[];
  content: string;
  lines: string[];
  currentNamespace?: string;
  currentClass?: string;
  currentStruct?: string;
  namespaceStack: string[];
}

export class CppGenerator extends OutlineGenerator {
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
    this.parser.setLanguage(Cpp as Parser.Language);
  }

  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      const elements = this.extractElements(content);
      return this.elementsToOutline(elements, options);
    } catch (error) {
      console.warn('Tree-sitter parsing failed, falling back to regex parsing:', error);
      // Fallback to regex-based parsing
      return this.extractElementsWithRegex(content, options);
    }
  }

  private extractElements(content: string): CodeElement[] {
    const context: CppContext = {
      elements: [],
      content,
      lines: content.split('\n'),
      namespaceStack: []
    };

    const tree = this.parser.parse(content);
    this.traverseNode(tree.rootNode, context);
    
    return context.elements;
  }

  private traverseNode(node: Parser.SyntaxNode, context: CppContext): void {
    switch (node.type) {
      case 'namespace_definition':
        this.handleNamespace(node, context);
        break;
      
      case 'class_specifier':
        this.handleClass(node, context);
        break;
      
      case 'struct_specifier':
        this.handleStruct(node, context);
        break;
      
      case 'enum_specifier':
        this.handleEnum(node, context);
        break;
      
      case 'union_specifier':
        this.handleUnion(node, context);
        break;
      
      case 'function_definition':
        this.handleFunction(node, context);
        break;
      
      case 'function_declarator':
        // Handle function declarations (not definitions)
        if (node.parent?.type === 'declaration') {
          this.handleFunctionDeclaration(node, context);
        }
        break;
      
      case 'field_declaration':
        this.handleField(node, context);
        break;
      
      case 'preproc_include':
        this.handleInclude(node, context);
        break;
      
      case 'preproc_def':
        this.handleMacro(node, context);
        break;
      
      case 'template_declaration':
        this.handleTemplate(node, context);
        break;
      
      case 'using_declaration':
        this.handleUsing(node, context);
        break;
      
      case 'typedef_declaration':
        this.handleTypedef(node, context);
        break;
    }

    // Recursively traverse child nodes
    for (const child of node.children) {
      this.traverseNode(child, context);
    }
  }

  private handleNamespace(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.closest('name');
    if (nameNode) {
      const namespaceName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.namespaceStack.push(namespaceName);
      const fullNamespace = context.namespaceStack.join('::');
      
      context.elements.push({
        name: namespaceName,
        type: 'namespace',
        visibility: 'public',
        position,
        docstring: this.extractDocstring(context.lines, position?.line),
        metadata: {
          fullPath: fullNamespace
        }
      });
      
      // Process namespace body
      const bodyNode = node.closest('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          this.traverseNode(child, context);
        }
      }
      
      context.namespaceStack.pop();
    }
  }

  private handleClass(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.closest('name');
    if (nameNode) {
      const className = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      const accessSpecifier = this.findAccessSpecifier(node, context.content);
      
      context.currentClass = className;
      
      context.elements.push({
        name: className,
        type: 'class',
        visibility: accessSpecifier,
        position,
        docstring: this.extractDocstring(context.lines, position?.line),
        metadata: {
          isTemplate: this.isTemplate(node),
          baseClasses: this.extractBaseClasses(node, context.content)
        }
      });
      
      // Process class body
      const bodyNode = node.closest('body');
      if (bodyNode) {
        this.processClassBody(bodyNode, context, 'private'); // Default access for class
      }
      
      context.currentClass = undefined;
    }
  }

  private handleStruct(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.closest('name');
    if (nameNode) {
      const structName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.currentStruct = structName;
      
      context.elements.push({
        name: structName,
        type: 'struct',
        visibility: 'public',
        position,
        docstring: this.extractDocstring(context.lines, position?.line),
        metadata: {
          isTemplate: this.isTemplate(node)
        }
      });
      
      // Process struct body
      const bodyNode = node.closest('body');
      if (bodyNode) {
        this.processClassBody(bodyNode, context, 'public'); // Default access for struct
      }
      
      context.currentStruct = undefined;
    }
  }

  private handleEnum(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.closest('name');
    if (nameNode) {
      const enumName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: enumName,
        type: 'enum',
        visibility: 'public',
        position,
        docstring: this.extractDocstring(context.lines, position?.line),
        metadata: {
          isClass: this.getNodeText(node, context.content).includes('enum class'),
          values: this.extractEnumValues(node, context.content)
        }
      });
    }
  }

  private handleUnion(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.closest('name');
    if (nameNode) {
      const unionName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: unionName,
        type: 'union',
        visibility: 'public',
        position,
        docstring: this.extractDocstring(context.lines, position?.line)
      });
    }
  }

  private handleFunction(node: Parser.SyntaxNode, context: CppContext): void {
    const declaratorNode = node.closest('declarator');
    if (declaratorNode && declaratorNode.type === 'function_declarator') {
      this.processFunctionDeclarator(declaratorNode, context, 'definition', node);
    }
  }

  private handleFunctionDeclaration(node: Parser.SyntaxNode, context: CppContext): void {
    this.processFunctionDeclarator(node, context, 'declaration');
  }

  private processFunctionDeclarator(node: Parser.SyntaxNode, context: CppContext, kind: 'definition' | 'declaration', parentNode?: Parser.SyntaxNode): void {
    const nameNode = node.closest('declarator');
    if (nameNode) {
      const functionName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(parentNode || node, context.lines);
      const accessSpecifier = this.findAccessSpecifier(parentNode || node, context.content);
      
      // Extract function signature details
      const parameters = this.extractParameters(node, context.content);
      const returnType = this.extractReturnType(parentNode || node, context.content);
      const isConstructor = functionName === context.currentClass;
      const isDestructor = functionName.startsWith('~');
      const isOperator = functionName.startsWith('operator');
      
      context.elements.push({
        name: functionName,
        type: isConstructor ? 'constructor' : 
              isDestructor ? 'destructor' : 
              isOperator ? 'operator' : 'function',
        visibility: accessSpecifier,
        isStatic: this.hasKeyword(parentNode || node, 'static', context.content),
        isAbstract: this.hasKeyword(parentNode || node, 'virtual', context.content) && 
                   this.hasKeyword(parentNode || node, '= 0', context.content),
        parameters,
        returnType: isConstructor || isDestructor ? undefined : returnType,
        position,
        docstring: this.extractDocstring(context.lines, position?.line),
        metadata: {
          kind,
          isVirtual: this.hasKeyword(parentNode || node, 'virtual', context.content),
          isOverride: this.hasKeyword(parentNode || node, 'override', context.content),
          isFinal: this.hasKeyword(parentNode || node, 'final', context.content),
          isConstexpr: this.hasKeyword(parentNode || node, 'constexpr', context.content),
          isInline: this.hasKeyword(parentNode || node, 'inline', context.content),
          isTemplate: this.isTemplate(parentNode || node)
        }
      });
    }
  }

  private handleField(node: Parser.SyntaxNode, context: CppContext): void {
    const declaratorNode = node.child(1); // Usually the declarator is the second child
    if (declaratorNode) {
      let fieldName = '';
      
      // Extract field name from various declarator types
      if (declaratorNode.type === 'init_declarator') {
        const nameNode = declaratorNode.closest('declarator');
        fieldName = nameNode ? this.getNodeText(nameNode, context.content) : '';
      } else {
        fieldName = this.getNodeText(declaratorNode, context.content);
      }
      
      if (fieldName) {
        const position = this.nodeToPosition(node, context.lines);
        const accessSpecifier = this.findAccessSpecifier(node, context.content);
        const fieldType = this.extractFieldType(node, context.content);
        
        context.elements.push({
          name: fieldName,
          type: 'field',
          visibility: accessSpecifier,
          isStatic: this.hasKeyword(node, 'static', context.content),
          returnType: fieldType,
          position,
          docstring: this.extractDocstring(context.lines, position?.line),
          metadata: {
            isMutable: this.hasKeyword(node, 'mutable', context.content),
            isConstexpr: this.hasKeyword(node, 'constexpr', context.content)
          }
        });
      }
    }
  }

  private handleInclude(node: Parser.SyntaxNode, context: CppContext): void {
    const pathNode = node.child(1); // #include <path> or #include "path"
    if (pathNode) {
      const includePath = this.getNodeText(pathNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: includePath,
        type: 'include',
        visibility: 'public',
        position,
        metadata: {
          isSystem: includePath.startsWith('<') && includePath.endsWith('>'),
          isLocal: includePath.startsWith('"') && includePath.endsWith('"')
        }
      });
    }
  }

  private handleMacro(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.child(1); // #define NAME
    if (nameNode) {
      const macroName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: macroName,
        type: 'macro',
        visibility: 'public',
        position,
        metadata: {
          definition: this.getNodeText(node, context.content)
        }
      });
    }
  }

  private handleTemplate(node: Parser.SyntaxNode, context: CppContext): void {
    // Template declarations wrap other declarations
    for (const child of node.children) {
      this.traverseNode(child, context);
    }
  }

  private handleUsing(node: Parser.SyntaxNode, context: CppContext): void {
    const nameNode = node.child(1);
    if (nameNode) {
      const usingName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: usingName,
        type: 'using',
        visibility: 'public',
        position
      });
    }
  }

  private handleTypedef(node: Parser.SyntaxNode, context: CppContext): void {
    // Extract typedef name (usually the last identifier)
    const children = node.children;
    const nameNode = children[children.length - 2]; // Before the semicolon
    
    if (nameNode) {
      const typedefName = this.getNodeText(nameNode, context.content);
      const position = this.nodeToPosition(node, context.lines);
      
      context.elements.push({
        name: typedefName,
        type: 'typedef',
        visibility: 'public',
        position,
        metadata: {
          definition: this.getNodeText(node, context.content)
        }
      });
    }
  }

  private processClassBody(bodyNode: Parser.SyntaxNode, context: CppContext, defaultAccess: 'public' | 'private' | 'protected'): void {
    let currentAccess = defaultAccess;
    
    for (const child of bodyNode.children) {
      // Check for access specifiers
      if (child.type === 'access_specifier') {
        const accessText = this.getNodeText(child, context.content);
        if (accessText.includes('public')) currentAccess = 'public';
        else if (accessText.includes('private')) currentAccess = 'private';
        else if (accessText.includes('protected')) currentAccess = 'protected';
      } else {
        // Set current access context for this member
        (child as any)._currentAccess = currentAccess;
        this.traverseNode(child, context);
      }
    }
  }

  // Helper methods
  private getNodeText(node: Parser.SyntaxNode, content: string): string {
    return content.slice(node.startIndex, node.endIndex);
  }


  private nodeToPosition(node: Parser.SyntaxNode, lines: string[]): Position {
    return {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1
    };
  }

  private findAccessSpecifier(node: Parser.SyntaxNode, content: string): 'public' | 'private' | 'protected' {
    // Check if the node has a stored access specifier
    if ((node as any)._currentAccess) {
      return (node as any)._currentAccess;
    }
    
    // For top-level declarations, default to public
    return 'public';
  }

  private isTemplate(node: Parser.SyntaxNode): boolean {
    return node.parent?.type === 'template_declaration';
  }

  private extractBaseClasses(node: Parser.SyntaxNode, content: string): string[] {
    const baseClasses: string[] = [];
    const baseClassListNode = node.closest('base_class_clause');
    
    if (baseClassListNode) {
      for (const child of baseClassListNode.children) {
        if (child.type === 'base_class_clause') {
          const baseName = this.getNodeText(child, content);
          baseClasses.push(baseName);
        }
      }
    }
    
    return baseClasses;
  }

  private extractEnumValues(node: Parser.SyntaxNode, content: string): string[] {
    const values: string[] = [];
    const bodyNode = node.closest('body');
    
    if (bodyNode) {
      for (const child of bodyNode.children) {
        if (child.type === 'enumerator') {
          const nameNode = child.closest('name');
          if (nameNode) {
            values.push(this.getNodeText(nameNode, content));
          }
        }
      }
    }
    
    return values;
  }

  private extractParameters(node: Parser.SyntaxNode, content: string): any[] {
    const parameters: any[] = [];
    const paramListNode = node.closest('parameters');
    
    if (paramListNode) {
      for (const child of paramListNode.children) {
        if (child.type === 'parameter_declaration') {
          const typeNode = child.closest('type');
          const declaratorNode = child.closest('declarator');
          
          if (declaratorNode) {
            const paramName = this.getNodeText(declaratorNode, content);
            const paramType = typeNode ? this.getNodeText(typeNode, content) : 'auto';
            
            parameters.push({
              name: paramName,
              type: paramType,
              optional: false // C++ doesn't have optional parameters like some other languages
            });
          }
        }
      }
    }
    
    return parameters;
  }

  private extractReturnType(node: Parser.SyntaxNode, content: string): string {
    // Look for return type in function declaration
    for (const child of node.children) {
      if (child.type === 'primitive_type' || child.type === 'type_identifier') {
        return this.getNodeText(child, content);
      }
    }
    return 'void';
  }

  private extractFieldType(node: Parser.SyntaxNode, content: string): string {
    const typeNode = node.child(0); // First child is usually the type
    return typeNode ? this.getNodeText(typeNode, content) : 'auto';
  }

  private hasKeyword(node: Parser.SyntaxNode, keyword: string, content: string): boolean {
    const nodeText = this.getNodeText(node, content);
    return nodeText.includes(keyword);
  }

  private extractDocstring(lines: string[], lineNumber?: number): string | undefined {
    if (!lineNumber || lineNumber <= 1) return undefined;

    // Look for C++ style comments (// or /* */) above the declaration
    let docLines: string[] = [];
    let currentIndex = lineNumber - 2;
    
    // Check for block comments
    while (currentIndex >= 0) {
      const line = lines[currentIndex].trim();
      
      if (line.endsWith('*/')) {
        // Found end of block comment
        docLines.unshift(line);
        currentIndex--;
        
        while (currentIndex >= 0) {
          const commentLine = lines[currentIndex].trim();
          docLines.unshift(commentLine);
          
          if (commentLine.startsWith('/*') || commentLine.startsWith('/**')) {
            return docLines.join('\n');
          }
          currentIndex--;
        }
        break;
      } else if (line.startsWith('//')) {
        // Single line comment
        docLines.unshift(line);
        currentIndex--;
      } else if (line === '') {
        // Skip empty lines
        currentIndex--;
      } else {
        // Found non-comment content
        break;
      }
    }
    
    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  // Fallback regex-based parsing
  private extractElementsWithRegex(content: string, options: GeneratorOptions): Promise<OutlineNode[]> {
    const elements: CodeElement[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

      // Namespace
      const namespaceMatch = line.match(/^namespace\s+(\w+)/);
      if (namespaceMatch) {
        elements.push({
          name: namespaceMatch[1],
          type: 'namespace',
          visibility: 'public',
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Class
      const classMatch = line.match(/^(?:template\s*<[^>]*>\s*)?class\s+(\w+)/);
      if (classMatch) {
        elements.push({
          name: classMatch[1],
          type: 'class',
          visibility: 'public',
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Struct
      const structMatch = line.match(/^(?:template\s*<[^>]*>\s*)?struct\s+(\w+)/);
      if (structMatch) {
        elements.push({
          name: structMatch[1],
          type: 'struct',
          visibility: 'public',
          position: { line: i + 1, column: 1 }
        });
        continue;
      }

      // Function (basic detection)
      const functionMatch = line.match(/^(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*[{;]/);
      if (functionMatch && !line.includes('class') && !line.includes('struct')) {
        elements.push({
          name: functionMatch[1],
          type: 'function',
          visibility: 'public',
          position: { line: i + 1, column: 1 }
        });
      }
    }

    return Promise.resolve(this.elementsToOutline(elements, options));
  }

  private elementsToOutline(elements: CodeElement[], options: GeneratorOptions): OutlineNode[] {
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
          docstring: element.docstring,
          ...element.metadata
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
    const containerTypes = ['namespace', 'class', 'struct', 'union', 'enum'];
    return containerTypes.includes(element.type) ? 1 : 2;
  }

  private isContainer(type: string): boolean {
    return ['namespace', 'class', 'struct', 'union', 'enum'].includes(type);
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
    return ['cpp', 'hpp', 'cc', 'hh', 'cxx', 'hxx', 'c++', 'h++'];
  }
}