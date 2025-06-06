import { OutlineGenerator } from './OutlineGenerator';
import { OutlineNode, GeneratorOptions, JsonSchema, SchemaProperty } from '../types';

export class JsonGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    try {
      const jsonData = JSON.parse(content);
      const schema = this.generateSchema(jsonData);
      return this.schemaToOutline(schema, options);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSchema(data: any, path: string = 'root'): JsonSchema {
    if (Array.isArray(data)) {
      const itemType = data.length > 0 ? this.getType(data[0]) : 'any';
      return {
        type: 'array',
        items: data.length > 0 ? this.generateSchema(data[0], `${path}[0]`) : { type: itemType }
      };
    }

    if (data && typeof data === 'object') {
      const properties: Record<string, SchemaProperty> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        properties[key] = this.generateSchema(value, `${path}.${key}`) as SchemaProperty;
        if (value !== null && value !== undefined) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }

    return { type: this.getType(data) };
  }

  private getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private schemaToOutline(schema: JsonSchema, options: GeneratorOptions, depth: number = 1, parentPath: string = ''): OutlineNode[] {
    const nodes: OutlineNode[] = [];

    if (schema.type === 'object' && schema.properties) {
      for (const [key, property] of Object.entries(schema.properties)) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key;
        const isRequired = schema.required?.includes(key) ?? false;
        
        const node = this.createNode(
          key,
          'property',
          depth,
          undefined,
          {
            dataType: property.type,
            required: isRequired,
            path: currentPath,
            description: property.description
          }
        );

        node.id = this.generateId(key, 'property');

        // Add children for nested objects/arrays
        if (property.type === 'object' && property.properties) {
          const childSchema: JsonSchema = {
            type: 'object',
            properties: property.properties,
            required: property.required
          };
          node.children = this.schemaToOutline(childSchema, options, depth + 1, currentPath);
        } else if (property.type === 'array' && property.items) {
          if (property.items.type === 'object' && property.items.properties) {
            const arrayItemSchema: JsonSchema = {
              type: 'object',
              properties: property.items.properties,
              required: property.items.required
            };
            node.children = this.schemaToOutline(arrayItemSchema, options, depth + 1, `${currentPath}[]`);
          }
        }

        nodes.push(node);
      }
    } else if (schema.type === 'array' && schema.items) {
      if (schema.items.type === 'object' && schema.items.properties) {
        const arraySchema: JsonSchema = {
          type: 'object',
          properties: schema.items.properties,
          required: schema.items.required
        };
        nodes.push(...this.schemaToOutline(arraySchema, options, depth, `${parentPath}[]`));
      }
    }

    return this.filterByDepth(nodes, options.maxDepth);
  }

  getSupportedExtensions(): string[] {
    return ['json'];
  }
}