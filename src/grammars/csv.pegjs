// CSV Outline Grammar for Peggy.js
// Parses CSV content with intelligent column analysis and type inference
// Directly outputs OutlineNode[] structure with rich metadata

start
  = csv

csv
  = rows:row* {
    if (rows.length === 0) {
      return [];
    }

    // Analyze the CSV structure
    const analysis = analyzeCSV(rows);
    
    return [
      {
        title: 'CSV Data',
        type: 'csv_document',
        depth: 1,
        line: 1,
        column: 1,
        metadata: {
          totalRows: analysis.totalRows,
          dataRows: analysis.dataRows,
          columnCount: analysis.columnCount,
          delimiter: analysis.delimiter,
          hasHeader: analysis.hasHeader
        },
        children: analysis.columns.map((col, idx) => ({
          title: col.name,
          type: `${col.type}_column`,
          depth: 2,
          line: 1,
          column: idx + 1,
          metadata: {
            index: idx,
            type: col.type,
            nullable: col.nullable,
            uniqueValues: col.uniqueValues,
            sampleValues: col.sampleValues,
            statistics: col.statistics
          },
          id: `column-${idx}-${col.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          children: []
        }))
      }
    ];
  }

row
  = fields:field_list line_ending { return fields; }
  / line_ending { return []; }

field_list
  = first:field rest:(delimiter field)* {
    return [first].concat(rest.map(r => r[1]));
  }

field
  = quoted_field
  / unquoted_field

quoted_field
  = '"' content:quoted_content '"' {
    return content;
  }

quoted_content
  = chars:quoted_char* { return chars.join(''); }

quoted_char
  = '""' { return '"'; }  // Escaped quote
  / [^"]                   // Any non-quote character

unquoted_field
  = chars:unquoted_char* { return chars.join('').trim(); }

unquoted_char
  = [^,;\t\r\n]  // Not delimiter or line ending

delimiter
  = [,;\t]  // Common delimiters: comma, semicolon, tab

line_ending
  = '\r\n' / '\n' / '\r' / !.

// === ANALYSIS FUNCTIONS ===
{
  function analyzeCSV(rows) {
    const nonEmptyRows = rows.filter(row => row.length > 0);
    
    if (nonEmptyRows.length === 0) {
      return {
        totalRows: 0,
        dataRows: 0,
        columnCount: 0,
        delimiter: ',',
        hasHeader: false,
        columns: []
      };
    }

    // Determine column count (most common row length)
    const columnCounts = {};
    nonEmptyRows.forEach(row => {
      const count = row.length;
      columnCounts[count] = (columnCounts[count] || 0) + 1;
    });
    
    const columnCount = parseInt(Object.keys(columnCounts)
      .reduce((a, b) => columnCounts[a] > columnCounts[b] ? a : b));

    // Detect if first row is header
    const hasHeader = detectHeader(nonEmptyRows, columnCount);
    
    // Extract headers and data
    const headers = hasHeader && nonEmptyRows.length > 0 ? 
      nonEmptyRows[0].slice(0, columnCount) : 
      Array.from({ length: columnCount }, (_, i) => `Column_${i + 1}`);
    
    const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;

    // Analyze columns
    const columns = analyzeColumns(headers, dataRows, columnCount);

    return {
      totalRows: rows.length,
      dataRows: dataRows.length,
      columnCount: columnCount,
      delimiter: ',', // Could be enhanced to detect from input
      hasHeader: hasHeader,
      columns: columns
    };
  }

  function detectHeader(rows, columnCount) {
    if (rows.length < 2) return false;
    
    const firstRow = rows[0].slice(0, columnCount);
    const secondRow = rows[1].slice(0, columnCount);
    
    let headerScore = 0;
    
    for (let i = 0; i < Math.min(firstRow.length, secondRow.length); i++) {
      const first = firstRow[i] || '';
      const second = secondRow[i] || '';
      
      // Headers more likely to be non-numeric
      if (isNaN(Number(first)) && !isNaN(Number(second))) {
        headerScore += 2;
      }
      
      // Headers more likely to be descriptive
      if (first.length > second.length && first.length > 3) {
        headerScore += 1;
      }
      
      // Headers often contain letters
      if (/[a-zA-Z]/.test(first) && !/[a-zA-Z]/.test(second)) {
        headerScore += 1;
      }
    }
    
    return headerScore > 0;
  }

  function analyzeColumns(headers, dataRows, columnCount) {
    const columns = [];
    
    for (let colIndex = 0; colIndex < columnCount; colIndex++) {
      const columnName = headers[colIndex] || `Column_${colIndex + 1}`;
      const values = dataRows
        .map(row => row[colIndex] || '')
        .filter(value => value.length > 0);
      
      const analysis = analyzeColumnValues(values);
      
      columns.push({
        name: columnName,
        type: analysis.type,
        nullable: dataRows.some(row => !row[colIndex] || row[colIndex].trim() === ''),
        uniqueValues: new Set(values).size,
        sampleValues: getSampleValues(values, 5),
        statistics: analysis.statistics
      });
    }
    
    return columns;
  }

  function analyzeColumnValues(values) {
    if (values.length === 0) {
      return { type: 'string', statistics: {} };
    }

    const sample = values.slice(0, Math.min(100, values.length));
    const patterns = {
      numeric: 0,
      boolean: 0,
      date: 0,
      email: 0,
      url: 0,
      phone: 0
    };

    const numericValues = [];
    const lengths = [];

    for (const value of sample) {
      const trimmed = value.trim();
      lengths.push(trimmed.length);
      
      // Check patterns
      if (isNumeric(trimmed)) {
        patterns.numeric++;
        numericValues.push(parseFloat(trimmed));
      }
      
      if (isBoolean(trimmed)) patterns.boolean++;
      if (isDate(trimmed)) patterns.date++;
      if (isEmail(trimmed)) patterns.email++;
      if (isUrl(trimmed)) patterns.url++;
      if (isPhone(trimmed)) patterns.phone++;
    }

    const total = sample.length;
    const threshold = 0.8;

    // Determine type based on patterns
    let type = 'string';
    if (patterns.email / total >= threshold) type = 'email';
    else if (patterns.url / total >= threshold) type = 'url';
    else if (patterns.phone / total >= threshold) type = 'phone';
    else if (patterns.boolean / total >= threshold) type = 'boolean';
    else if (patterns.numeric / total >= threshold) type = 'number';
    else if (patterns.date / total >= threshold) type = 'date';

    // Calculate statistics
    const statistics = {
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      avgLength: lengths.reduce((a, b) => a + b, 0) / lengths.length
    };

    if (type === 'number' && numericValues.length > 0) {
      statistics.min = Math.min(...numericValues);
      statistics.max = Math.max(...numericValues);
      statistics.avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      statistics.median = calculateMedian(numericValues);
    }

    return { type, statistics };
  }

  function isNumeric(value) {
    return !isNaN(Number(value)) && value.trim() !== '';
  }

  function isBoolean(value) {
    const lower = value.toLowerCase();
    return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(lower);
  }

  function isDate(value) {
    if (!value || value.length < 6) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  function isEmail(value) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
  }

  function isUrl(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  function isPhone(value) {
    // Basic phone number pattern
    return /^[\\+]?[1-9]?[0-9]{7,15}$/.test(value.replace(/[\\s\\-\\(\\)]/g, ''));
  }

  function getSampleValues(values, count) {
    const unique = Array.from(new Set(values));
    return unique.slice(0, count);
  }

  function calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }
}
