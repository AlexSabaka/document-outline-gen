import { GeneratorOptions, OutlineNode, CodeElement } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

export class JavaGenerator extends OutlineGenerator {
    async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
        const lines = content.split('\n');
        const elements = this.extractElements(lines);
        return this.elementsToOutline(elements, options);
    }

    private extractElements(lines: string[]): CodeElement[] {
        const elements: CodeElement[] = [];
        let currentClass = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

            // Class definition
            const classMatch = line.match(/(?:public|private|protected)?\s*class\s+(\w+)/);
            if (classMatch) {
                currentClass = classMatch[1];
                elements.push({
                    name: currentClass,
                    type: 'class',
                    visibility: this.extractVisibility(line),
                    position: { line: i + 1, column: 1 }
                });
                continue;
            }

            // Method definition
            const methodMatch = line.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*\{?/);
            if (methodMatch && currentClass && !line.includes('class')) {
                const methodName = methodMatch[1];
                if (methodName !== currentClass) { // Not a constructor
                    elements.push({
                        name: methodName,
                        type: 'method',
                        visibility: this.extractVisibility(line),
                        isStatic: line.includes('static'),
                        position: { line: i + 1, column: 1 }
                    });
                }
            }

            // Field definition
            const fieldMatch = line.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(\w+)\s+(\w+)/);
            if (fieldMatch && currentClass && line.includes(';') && !line.includes('(')) {
                const fieldName = fieldMatch[2];
                elements.push({
                    name: fieldName,
                    type: 'property',
                    visibility: this.extractVisibility(line),
                    isStatic: line.includes('static'),
                    position: { line: i + 1, column: 1 }
                });
            }
        }

        return elements;
    }

    private extractVisibility(line: string): 'public' | 'private' | 'protected' {
        if (line.includes('private')) return 'private';
        if (line.includes('protected')) return 'protected';
        return 'public';
    }

    private elementsToOutline(elements: CodeElement[], options: GeneratorOptions): OutlineNode[] {
        // Similar to Python implementation but adapted for Java
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
                    isStatic: element.isStatic
                }
            );

            if (element.type === 'class') {
                classNodes.set(element.name, node);
                nodes.push(node);
            } else {
                // Find parent class
                const parentClass = Array.from(classNodes.values()).pop();
                if (parentClass) {
                    if (!parentClass.children) parentClass.children = [];
                    parentClass.children.push(node);
                } else {
                    nodes.push(node);
                }
            }
        }

        return this.filterByDepth(nodes, options.maxDepth);
    }

    getSupportedExtensions(): string[] {
        return ['java'];
    }
}
