import { GeneratorOptions, OutlineNode, CodeElement } from "../../types";
import { OutlineGenerator } from "../OutlineGenerator";

export class CSharpGenerator extends OutlineGenerator {
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
            const classMatch = line.match(/(?:public|private|internal)?\s*(?:abstract\s+)?(?:sealed\s+)?class\s+(\w+)/);
            if (classMatch) {
                currentClass = classMatch[1];
                elements.push({
                    name: currentClass,
                    type: 'class',
                    visibility: this.extractVisibility(line),
                    isAbstract: line.includes('abstract'),
                    position: { line: i + 1, column: 1 }
                });
                continue;
            }

            // Method definition
            const methodMatch = line.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+\s+)+(\w+)\s*\([^)]*\)/);
            if (methodMatch && currentClass && line.includes('{')) {
                elements.push({
                    name: methodMatch[1],
                    type: 'method',
                    visibility: this.extractVisibility(line),
                    isStatic: line.includes('static'),
                    position: { line: i + 1, column: 1 }
                });
            }

            // Property definition
            const propertyMatch = line.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(\w+)\s+(\w+)\s*\{/);
            if (propertyMatch && currentClass) {
                elements.push({
                    name: propertyMatch[2],
                    type: 'property',
                    visibility: this.extractVisibility(line),
                    isStatic: line.includes('static'),
                    position: { line: i + 1, column: 1 }
                });
            }
        }

        return elements;
    }

    private extractVisibility(line: string): 'public' | 'private' | 'protected' | 'internal' {
        if (line.includes('private')) return 'private';
        if (line.includes('protected')) return 'protected';
        if (line.includes('internal')) return 'internal';
        return 'public';
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
                    isStatic: element.isStatic,
                    isAbstract: element.isAbstract
                }
            );

            if (element.type === 'class') {
                classNodes.set(element.name, node);
                nodes.push(node);
            } else {
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
        return ['cs'];
    }
}
