import yaml from 'js-yaml';
import { GeneratorOptions, OutlineNode } from '../types';
import { OutlineGenerator } from './OutlineGenerator';

export class YamlGenerator extends OutlineGenerator {
    async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
        try {
            const yamlData = yaml.load(content);
            return this.yamlToOutline(yamlData, options);
        } catch (error) {
            throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private yamlToOutline(data: any, options: GeneratorOptions, depth: number = 1, parentPath: string = ''): OutlineNode[] {
        const nodes: OutlineNode[] = [];

        if (typeof data === 'object' && data !== null) {
            const entries = Array.isArray(data) ? data.map((item, index) => [index.toString(), item]) : Object.entries(data);

            for (const [key, value] of entries) {
                const currentPath = parentPath ? `${parentPath}.${key}` : key;
                const hasChildren = typeof value === 'object' && value !== null;
                const isArray = Array.isArray(value);

                const node = this.createNode(
                    key,
                    isArray ? 'array' : hasChildren ? 'object' : this.getYamlType(value),
                    depth,
                    undefined,
                    {
                        path: currentPath,
                        dataType: this.getYamlType(value),
                        isArray,
                        value: hasChildren ? undefined : value
                    }
                );

                node.id = this.generateId(key, node.type);

                if (hasChildren) {
                    node.children = this.yamlToOutline(value, options, depth + 1, currentPath);
                }

                nodes.push(node);
            }
        }

        return this.filterByDepth(nodes, options.maxDepth);
    }

    private getYamlType(value: any): string {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'object') return 'object';
        return 'unknown';
    }

    getSupportedExtensions(): string[] {
        return ['yaml', 'yml'];
    }
}
