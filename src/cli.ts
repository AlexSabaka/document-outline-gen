#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs/promises';
import DocumentOutlineGenerator from '.';
import { GeneratorOptions } from './types';


program
  .name('document-outline-generator')
  .description('Generate outline structures for various document types and code files')
  .version('1.0.0');

program
  .argument('<file>', 'file to analyze')
  .option('-d, --max-depth <number>', 'maximum depth to traverse', parseInt)
  .option('-l, --line-numbers', 'include line numbers in output')
  .option('-p, --include-private', 'include private members (for code files)')
  .option('-c, --include-comments', 'include comments and docstrings')
  .option('-f, --format <type>', 'output format (json|tree)', 'tree')
  .option('-o, --output <file>', 'output file (default: stdout)')
  .option('--peggy', 'use Peggy parsers', false)
  .action(async (file: string, options: any) => {
    try {
      const generator = new DocumentOutlineGenerator({ usePeggyGenerators: options.peggy });
      
      // Check if file exists
      await fs.access(file);
      
      // Prepare options
      const generatorOptions: GeneratorOptions = {
        includeLineNumbers: options.lineNumbers,
        maxDepth: options.maxDepth,
        includePrivate: options.includePrivate,
        includeComments: options.includeComments
      };
      
      // Generate outline
      const outline = await generator.generateFromFile(file, generatorOptions);
      
      // Format output
      let output: string;
      if (options.format === 'json') {
        output = JSON.stringify(outline, null, 2);
      } else {
        output = formatAsTree(outline);
      }
      
      // Write output
      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(`Outline written to ${options.output}`);
      } else {
        console.log(output);
      }
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('list-extensions')
  .description('List all supported file extensions')
  .action(() => {
    const generator = new DocumentOutlineGenerator();
    const extensions = generator.getSupportedExtensions();
    
    console.log('Supported file extensions:');
    extensions.sort().forEach(ext => {
      console.log(`  .${ext}`);
    });
  });

function formatAsTree(nodes: any[], depth: number = 0): string {
  let result = '';
  const indent = '  '.repeat(depth);
  
  for (const node of nodes) {
    const line = node.line ? ` (line ${node.line})` : '';
    const metadata = node.metadata ? formatMetadata(node.metadata) : '';
    result += `${indent}├─ ${node.title} [${node.type}]${line}${metadata}\n`;
    
    if (node.children && node.children.length > 0) {
      result += formatAsTree(node.children, depth + 1);
    }
  }
  
  return result;
}

function formatMetadata(metadata: Record<string, any>): string {
  const parts: string[] = [];
  
  if (metadata.visibility && metadata.visibility !== 'public') {
    parts.push(metadata.visibility);
  }
  
  if (metadata.isStatic) {
    parts.push('static');
  }
  
  if (metadata.isAbstract) {
    parts.push('abstract');
  }
  
  if (metadata.parameters && metadata.parameters.length > 0) {
    const params = metadata.parameters.map((p: any) => p.name).join(', ');
    parts.push(`params: ${params}`);
  }
  
  if (metadata.dataType) {
    parts.push(`type: ${metadata.dataType}`);
  }
  
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

// Add to package.json scripts
if (require.main === module) {
  program.parse();
}

export { program };