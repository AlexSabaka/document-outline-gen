import { GeneratorOptions, OutlineNode, CodeElement, Position } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

import * as cs from "@fluffy-spoon/csharp-parser";

export class CSharpGenerator extends OutlineGenerator {
    async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
        try {
            const file = new cs.FileParser(content).parseFile();
            const elements = this.extractElements(file, content);
            return this.elementsToOutline(elements, options);
        } catch (error) {
            throw new Error(`Failed to parse C# code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private extractElements(file: cs.CSharpFile, content: string): CodeElement[] {
        const elements: CodeElement[] = [];
        const lines = content.split('\n');

        // Extract namespaces
        for (const namespace of file.namespaces || []) {
            this.extractFromNamespace(namespace, elements, lines, '');
        }

        // Extract top-level classes
        for (const cls of file.classes || []) {
            this.extractFromClass(cls, elements, lines, '');
        }

        // Extract top-level interfaces
        for (const iface of file.interfaces || []) {
            this.extractFromInterface(iface, elements, lines, '');
        }

        // Extract top-level enums
        for (const enumItem of file.enums || []) {
            this.extractFromEnum(enumItem, elements, lines, '');
        }

        // Extract top-level structs
        for (const struct of file.structs || []) {
            this.extractFromStruct(struct, elements, lines, '');
        }

        return elements;
    }

    private extractFromNamespace(namespace: any, elements: CodeElement[], lines: string[], parentPath: string): void {
        const namespacePath = parentPath ? `${parentPath}.${namespace.name}` : namespace.name;
        const position = this.findPosition(lines, `namespace ${namespace.name}`);

        elements.push({
            name: namespace.name,
            type: 'namespace',
            position,
            visibility: 'public'
        });

        // Extract nested namespaces
        for (const nestedNamespace of namespace.namespaces || []) {
            this.extractFromNamespace(nestedNamespace, elements, lines, namespacePath);
        }

        // Extract classes in namespace
        for (const cls of namespace.classes || []) {
            this.extractFromClass(cls, elements, lines, namespacePath);
        }

        // Extract interfaces in namespace
        for (const iface of namespace.interfaces || []) {
            this.extractFromInterface(iface, elements, lines, namespacePath);
        }

        // Extract enums in namespace
        for (const enumItem of namespace.enums || []) {
            this.extractFromEnum(enumItem, elements, lines, namespacePath);
        }

        // Extract structs in namespace
        for (const struct of namespace.structs || []) {
            this.extractFromStruct(struct, elements, lines, namespacePath);
        }
    }

    private extractFromClass(cls: any, elements: CodeElement[], lines: string[], parentPath: string): void {
        const position = this.findPosition(lines, `class ${cls.name}`) || 
                        this.findPosition(lines, `public class ${cls.name}`) ||
                        this.findPosition(lines, `private class ${cls.name}`) ||
                        this.findPosition(lines, `protected class ${cls.name}`) ||
                        this.findPosition(lines, `internal class ${cls.name}`);

        elements.push({
            name: cls.name,
            type: 'class',
            visibility: this.getVisibility(cls),
            isStatic: cls.isStatic || false,
            isAbstract: cls.isAbstract || false,
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });

        // Extract constructors
        for (const constructor of cls.constructors || []) {
            this.extractFromConstructor(constructor, elements, lines, cls.name);
        }

        // Extract methods
        for (const method of cls.methods || []) {
            this.extractFromMethod(method, elements, lines, cls.name);
        }

        // Extract properties
        for (const property of cls.properties || []) {
            this.extractFromProperty(property, elements, lines, cls.name);
        }

        // Extract fields
        for (const field of cls.fields || []) {
            this.extractFromField(field, elements, lines, cls.name);
        }

        // Extract nested classes
        for (const nestedClass of cls.classes || []) {
            this.extractFromClass(nestedClass, elements, lines, `${parentPath}.${cls.name}`);
        }

        // Extract nested interfaces
        for (const nestedInterface of cls.interfaces || []) {
            this.extractFromInterface(nestedInterface, elements, lines, `${parentPath}.${cls.name}`);
        }

        // Extract nested enums
        for (const nestedEnum of cls.enums || []) {
            this.extractFromEnum(nestedEnum, elements, lines, `${parentPath}.${cls.name}`);
        }

        // Extract nested structs
        for (const nestedStruct of cls.structs || []) {
            this.extractFromStruct(nestedStruct, elements, lines, `${parentPath}.${cls.name}`);
        }
    }

    private extractFromInterface(iface: any, elements: CodeElement[], lines: string[], parentPath: string): void {
        const position = this.findPosition(lines, `interface ${iface.name}`) ||
                        this.findPosition(lines, `public interface ${iface.name}`) ||
                        this.findPosition(lines, `internal interface ${iface.name}`);

        elements.push({
            name: iface.name,
            type: 'interface',
            visibility: this.getVisibility(iface),
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });

        // Extract interface methods
        for (const method of iface.methods || []) {
            this.extractFromMethod(method, elements, lines, iface.name, true);
        }

        // Extract interface properties
        for (const property of iface.properties || []) {
            this.extractFromProperty(property, elements, lines, iface.name, true);
        }
    }

    private extractFromEnum(enumItem: any, elements: CodeElement[], lines: string[], parentPath: string): void {
        const position = this.findPosition(lines, `enum ${enumItem.name}`) ||
                        this.findPosition(lines, `public enum ${enumItem.name}`) ||
                        this.findPosition(lines, `internal enum ${enumItem.name}`);

        elements.push({
            name: enumItem.name,
            type: 'enum',
            visibility: this.getVisibility(enumItem),
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });

        // Extract enum values
        for (const value of enumItem.values || []) {
            const valuePosition = this.findPosition(lines, value.name);
            elements.push({
                name: value.name,
                type: 'enum-value',
                visibility: 'public',
                position: valuePosition
            });
        }
    }

    private extractFromStruct(struct: any, elements: CodeElement[], lines: string[], parentPath: string): void {
        const position = this.findPosition(lines, `struct ${struct.name}`) ||
                        this.findPosition(lines, `public struct ${struct.name}`) ||
                        this.findPosition(lines, `internal struct ${struct.name}`);

        elements.push({
            name: struct.name,
            type: 'struct',
            visibility: this.getVisibility(struct),
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });

        // Extract struct members (similar to class)
        for (const constructor of struct.constructors || []) {
            this.extractFromConstructor(constructor, elements, lines, struct.name);
        }

        for (const method of struct.methods || []) {
            this.extractFromMethod(method, elements, lines, struct.name);
        }

        for (const property of struct.properties || []) {
            this.extractFromProperty(property, elements, lines, struct.name);
        }

        for (const field of struct.fields || []) {
            this.extractFromField(field, elements, lines, struct.name);
        }
    }

    private extractFromConstructor(constructor: any, elements: CodeElement[], lines: string[], className: string): void {
        const position = this.findPosition(lines, `${className}(`) ||
                        this.findPosition(lines, `public ${className}(`) ||
                        this.findPosition(lines, `private ${className}(`) ||
                        this.findPosition(lines, `protected ${className}(`);

        elements.push({
            name: className, // Constructor name is same as class name
            type: 'constructor',
            visibility: this.getVisibility(constructor),
            isStatic: constructor.isStatic || false,
            parameters: this.extractParameters(constructor.parameters || []),
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });
    }

    private extractFromMethod(method: any, elements: CodeElement[], lines: string[], parentName: string, isInterface: boolean = false): void {
        const position = this.findPosition(lines, `${method.name}(`) ||
                        this.findPosition(lines, `public ${method.name}(`) ||
                        this.findPosition(lines, `private ${method.name}(`) ||
                        this.findPosition(lines, `protected ${method.name}(`) ||
                        this.findPosition(lines, `internal ${method.name}(`);

        elements.push({
            name: method.name,
            type: isInterface ? 'interface-method' : 'method',
            visibility: this.getVisibility(method),
            isStatic: method.isStatic || false,
            isAbstract: method.isAbstract || false,
            parameters: this.extractParameters(method.parameters || []),
            returnType: method.returnType?.name || 'void',
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });
    }

    private extractFromProperty(property: any, elements: CodeElement[], lines: string[], parentName: string, isInterface: boolean = false): void {
        const position = this.findPosition(lines, `${property.name} {`) ||
                        this.findPosition(lines, `${property.name} =>`) ||
                        this.findPosition(lines, `public ${property.name} {`) ||
                        this.findPosition(lines, `private ${property.name} {`) ||
                        this.findPosition(lines, `protected ${property.name} {`);

        elements.push({
            name: property.name,
            type: isInterface ? 'interface-property' : 'property',
            visibility: this.getVisibility(property),
            isStatic: property.isStatic || false,
            isAbstract: property.isAbstract || false,
            returnType: property.type?.name || 'object',
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });
    }

    private extractFromField(field: any, elements: CodeElement[], lines: string[], parentName: string): void {
        const position = this.findPosition(lines, field.name);

        elements.push({
            name: field.name,
            type: 'field',
            visibility: this.getVisibility(field),
            isStatic: field.isStatic || false,
            returnType: field.type?.name || 'object',
            position,
            docstring: this.extractDocstring(lines, position?.line)
        });
    }

    private extractParameters(parameters: any[]): any[] {
        return parameters.map(param => ({
            name: param.name || 'unknown',
            type: param.type?.name || 'object',
            optional: param.hasDefaultValue || false,
            defaultValue: param.defaultValue || undefined
        }));
    }

    private getVisibility(item: any): 'public' | 'private' | 'protected' | 'internal' {
        if (item._isPrivate || item.isPrivate) return 'private';
        if (item._isProtected || item.isProtected) return 'protected';
        if (item._isInternal || item.isInternal) return 'internal';
        if (item._isPublic || item.isPublic) return 'public';
        
        // Default to public for interfaces, internal for others
        return item.type === 'interface' ? 'public' : 'internal';
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

    private extractDocstring(lines: string[], lineNumber?: number): string | undefined {
        if (!lineNumber || lineNumber <= 1) return undefined;

        // Look for XML documentation comments (///) above the declaration
        const prevLineIndex = lineNumber - 2;
        if (prevLineIndex >= 0 && prevLineIndex < lines.length) {
            const prevLine = lines[prevLineIndex].trim();
            if (prevLine.startsWith('///')) {
                // Found XML doc comment, could collect multiple lines
                let docLines: string[] = [];
                let currentIndex = prevLineIndex;
                
                // Collect all consecutive /// lines
                while (currentIndex >= 0 && lines[currentIndex].trim().startsWith('///')) {
                    docLines.unshift(lines[currentIndex].trim());
                    currentIndex--;
                }
                
                return docLines.join('\n');
            }
            
            // Look for block comments (/* */)
            if (prevLine.includes('*/')) {
                return prevLine;
            }
        }
        
        return undefined;
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
                const parentContainer = this.findParentContainer(element, containerNodes, elements);
                
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
        const containerTypes = ['namespace', 'class', 'interface', 'struct', 'enum'];
        return containerTypes.includes(element.type) ? 1 : 2;
    }

    private isContainer(type: string): boolean {
        return ['namespace', 'class', 'interface', 'struct', 'enum'].includes(type);
    }

    private findParentContainer(element: CodeElement, containerNodes: Map<string, OutlineNode>, allElements: CodeElement[]): OutlineNode | undefined {
        // Simple heuristic: find the most recent container that appears before this element
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
        return ['cs'];
    }
}