import { GeneratorOptions, OutlineNode } from "../types";
import { OutlineGenerator } from "./OutlineGenerator";

import Parser from "tree-sitter";
import { default as csv } from "tree-sitter-csv";

// const parser = new Parser();
// console.log(csv.csv as Parser.Language);
// parser.setLanguage(csv.csv as Parser.Language);

// console.log(parser);

interface CsvColumn {
  name: string;
  index: number;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'mixed';
  nullable: boolean;
  uniqueValues: number;
  sampleValues: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  avgLength?: number;
}

interface CsvStats {
  totalRows: number;
  dataRows: number;
  columns: CsvColumn[];
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  emptyRows: number;
}

export class CsvGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const stats = this.analyzeCsv(content, options);
    return this.statsToOutline(stats, options);
  }

  private analyzeCsv(content: string, options: GeneratorOptions): CsvStats {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return {
        totalRows: 0,
        dataRows: 0,
        columns: [],
        delimiter: ',',
        hasHeader: false,
        encoding: 'UTF-8',
        emptyRows: 0
      };
    }

    // Detect delimiter
    const delimiter = this.detectDelimiter(lines);
    
    // Parse all rows
    const rows = lines.map(line => this.parseCsvLine(line, delimiter));
    
    // Detect if first row is header
    const hasHeader = this.detectHeader(rows);
    
    // Get column count (use the most common row length)
    const columnCount = this.getColumnCount(rows);
    
    // Extract headers
    const headers = hasHeader && rows.length > 0 ? 
      rows[0].slice(0, columnCount) : 
      Array.from({ length: columnCount }, (_, i) => `Column_${i + 1}`);
    
    // Get data rows (skip header if present)
    const dataRows = hasHeader ? rows.slice(1) : rows;
    
    // Analyze each column
    const columns = this.analyzeColumns(headers, dataRows, columnCount);
    
    return {
      totalRows: lines.length,
      dataRows: dataRows.length,
      columns,
      delimiter,
      hasHeader,
      encoding: 'UTF-8', // Could be enhanced to detect encoding
      emptyRows: content.split('\n').length - lines.length
    };
  }

  private detectDelimiter(lines: string[]): string {
    const delimiters = [',', ';', '\t', '|', ':'];
    const sample = lines.slice(0, Math.min(5, lines.length)).join('\n');
    
    let bestDelimiter = ',';
    let maxScore = 0;
    
    for (const delimiter of delimiters) {
      const rowLengths = lines.slice(0, 10).map(line => 
        this.parseCsvLine(line, delimiter).length
      );
      
      // Score based on consistency of column count
      const avgLength = rowLengths.reduce((a, b) => a + b, 0) / rowLengths.length;
      const variance = rowLengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / rowLengths.length;
      const consistency = avgLength > 1 ? 1 / (1 + variance) : 0;
      
      // Bonus for reasonable column count
      const reasonableCount = avgLength >= 2 && avgLength <= 50 ? 1 : 0.5;
      
      const score = consistency * reasonableCount * avgLength;
      
      if (score > maxScore) {
        maxScore = score;
        bestDelimiter = delimiter;
      }
    }
    
    return bestDelimiter;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  private detectHeader(rows: string[][]): boolean {
    if (rows.length < 2) return false;
    
    const firstRow = rows[0];
    const secondRow = rows[1];
    
    if (firstRow.length !== secondRow.length) return false;
    
    let headerScore = 0;
    
    for (let i = 0; i < firstRow.length; i++) {
      const first = firstRow[i];
      const second = secondRow[i];
      
      // Headers are more likely to be non-numeric
      if (isNaN(Number(first)) && !isNaN(Number(second))) {
        headerScore += 2;
      }
      
      // Headers are more likely to be longer and descriptive
      if (first.length > second.length && first.length > 3) {
        headerScore += 1;
      }
      
      // Headers often contain letters
      if (/[a-zA-Z]/.test(first) && !/[a-zA-Z]/.test(second)) {
        headerScore += 1;
      }
      
      // Headers shouldn't be empty
      if (first.length === 0) {
        headerScore -= 2;
      }
    }
    
    return headerScore > 0;
  }

  private getColumnCount(rows: string[][]): number {
    const counts = new Map<number, number>();
    
    for (const row of rows) {
      const count = row.length;
      counts.set(count, (counts.get(count) || 0) + 1);
    }
    
    // Return the most common column count
    let maxCount = 0;
    let bestColumnCount = 0;
    
    for (const [columnCount, frequency] of counts.entries()) {
      if (frequency > maxCount) {
        maxCount = frequency;
        bestColumnCount = columnCount;
      }
    }
    
    return bestColumnCount;
  }

  private analyzeColumns(headers: string[], dataRows: string[][], columnCount: number): CsvColumn[] {
    const columns: CsvColumn[] = [];
    
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const columnName = headers[colIndex] || `Column_${colIndex + 1}`;
      const values = dataRows
        .map(row => row[colIndex] || '')
        .filter(value => value.length > 0);
      
      const column: CsvColumn = {
        name: columnName,
        index: colIndex,
        type: this.inferColumnType(values),
        nullable: dataRows.some(row => !row[colIndex] || row[colIndex].trim() === ''),
        uniqueValues: new Set(values).size,
        sampleValues: this.getSampleValues(values, 5),
        minLength: Math.min(...values.map(v => v.length)),
        maxLength: Math.max(...values.map(v => v.length)),
        avgLength: values.reduce((sum, v) => sum + v.length, 0) / values.length || 0
      };
      
      // Add numeric statistics if column is numeric
      if (column.type === 'number') {
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (numericValues.length > 0) {
          column.min = Math.min(...numericValues);
          column.max = Math.max(...numericValues);
        }
      }
      
      columns.push(column);
    }
    
    return columns;
  }

  private inferColumnType(values: string[]): CsvColumn['type'] {
    if (values.length === 0) return 'string';
    
    const sample = values.slice(0, Math.min(100, values.length));
    let numericCount = 0;
    let booleanCount = 0;
    let dateCount = 0;
    let emailCount = 0;
    let urlCount = 0;
    
    for (const value of sample) {
      const trimmed = value.trim().toLowerCase();
      
      // Check for boolean
      if (['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(trimmed)) {
        booleanCount++;
      }
      
      // Check for number
      if (!isNaN(Number(value)) && value.trim() !== '') {
        numericCount++;
      }
      
      // Check for date
      if (this.isDate(value)) {
        dateCount++;
      }
      
      // Check for email
      if (this.isEmail(value)) {
        emailCount++;
      }
      
      // Check for URL
      if (this.isUrl(value)) {
        urlCount++;
      }
    }
    
    const total = sample.length;
    const threshold = 0.8; // 80% of values should match the type
    
    if (emailCount / total >= threshold) return 'email';
    if (urlCount / total >= threshold) return 'url';
    if (booleanCount / total >= threshold) return 'boolean';
    if (numericCount / total >= threshold) return 'number';
    if (dateCount / total >= threshold) return 'date';
    
    // Check for mixed types
    const typeCount = [numericCount, booleanCount, dateCount, emailCount, urlCount]
      .filter(count => count > 0).length;
    
    if (typeCount > 1) return 'mixed';
    
    return 'string';
  }

  private isDate(value: string): boolean {
    if (!value || value.length < 6) return false;
    
    // Try parsing as date
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    
    // Check for common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
      /^\d{2}\.\d{2}\.\d{4}$/,         // DD.MM.YYYY
    ];
    
    return datePatterns.some(pattern => pattern.test(value.trim()));
  }

  private isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value.trim());
      return true;
    } catch {
      return false;
    }
  }

  private getSampleValues(values: string[], count: number): string[] {
    const unique = Array.from(new Set(values));
    return unique.slice(0, count);
  }

  private statsToOutline(stats: CsvStats, options: GeneratorOptions): OutlineNode[] {
    const nodes: OutlineNode[] = [];
    
    // Columns section
    if (stats.columns.length > 0) {
      const columnsNode = this.createNode(
        'Columns',
        'section',
        1,
        undefined,
        {
          count: stats.columns.length
        }
      );
      
      columnsNode.id = 'csv-columns';
      columnsNode.children = [];
      
      for (const column of stats.columns) {
        const columnNode = this.createNode(
          column.name,
          column.type + ' column',
          2,
          undefined,
          {
            index: column.index,
            type: column.type,
            nullable: column.nullable,
            uniqueValues: column.uniqueValues,
            sampleValues: column.sampleValues,
            minLength: column.minLength,
            maxLength: column.maxLength,
            avgLength: Math.round((column.avgLength ?? 0) * 100) / 100,
            min: column.min,
            max: column.max,
          }
        );
        
        columnNode.id = this.generateId(column.name, 'column', column.index);
        columnsNode.children.push(columnNode);
      }
      
      nodes.push(columnsNode);
    }

    return this.filterByDepth(nodes, options.maxDepth);
  }

  getSupportedExtensions(): string[] {
    return ['csv'];
  }
}