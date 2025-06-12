// Smart Markdown Outline Grammar - Fixed hierarchy and filtering
// Outputs proper OutlineNode[] with hierarchical structure like the legacy parser

document
    = elements:(
        header
        / altHeader
        / table
        / codeBlock
        / list
        / horizontalRule
        / blockquote
        / paragraph
        / skipLine
    )+ {
        // Filter to get only outline-worthy elements
        const flatNodes = elements.filter(el => el && el.title && el.type);
        
        // Build hierarchical structure for headers
        return buildHierarchy(flatNodes);
    }
    / !. { return []; }

// HEADERS - Main structural elements
header
    = hashes:("#"+) " " headerText:headerContent "\n"? {
        const level = Math.min(hashes.length, 6);
        const title = extractText(headerText).trim();
        
        return {
            title: title,
            type: 'heading',
            depth: level,
            line: location().start.line,
            column: location().start.column,
            children: [],
            metadata: {
                level: level,
                rawTitle: title
            },
            id: generateId(title, 'heading', location().start.line),
            anchor: createAnchor(title)
        };
    }

altHeader
    = headerText:headerContent "\n" underline:("="+ / "-"+) "\n"? {
        const level = underline[0] === '=' ? 1 : 2;
        const title = extractText(headerText).trim();
        
        return {
            title: title,
            type: 'heading', 
            depth: level,
            line: location().start.line,
            column: location().start.column,
            children: [],
            metadata: {
                level: level,
                style: 'underline'
            },
            id: generateId(title, 'heading', location().start.line),
            anchor: createAnchor(title)
        };
    }

// TABLES - Important structural elements
table
    = headerRow:tableRow
      separatorRow:tableSeparator
      dataRows:tableRow* {
        const headers = headerRow;
        const columnCount = headers.length;
        
        return {
            title: `Table (${columnCount} columns)`,
            type: 'table',
            depth: 1,
            line: location().start.line,
            column: location().start.column,
            children: [],
            metadata: {
                columnCount: columnCount,
                headers: headers,
                rowCount: dataRows.length,
                hasHeader: true
            }
        };
    }

tableRow
    = "|"? cells:tableCell+ "|"? "\n"? {
        return cells.map(cell => cell.trim());
    }

tableCell
    = content:(!"|" !"\n" .)* "|"? {
        return content.map(c => c[2]).join('').trim();
    }

tableSeparator
    = "|"? separators:tableSepCell+ "|"? "\n"? {
        return separators;
    }

tableSepCell
    = content:("-"+ / ":"+ "-"* ":"*) "|"? {
        return content;
    }

// CODE BLOCKS - Include only if significant
codeBlock
    = "```" language:languageName? content:codeContent "```" "\n"? {
        const lang = language || 'text';
        const code = content.trim();
        
        // Only include substantial code blocks in outline
        if (code.length > 50) {
            return {
                title: `Code (${lang})`,
                type: 'code_block',
                depth: 1,
                line: location().start.line,
                column: location().start.column,
                children: [],
                metadata: {
                    language: lang,
                    lines: code.split('\n').length,
                    size: code.length
                }
            };
        }
        return null;
    }

languageName = chars:[a-zA-Z0-9]+ { return chars.join(''); }
codeContent = content:(!"```" .)* { return content.map(c => c[1]).join(''); }

// LISTS - Include only significant lists
list
    = items:listItem+ {
        const firstItem = items[0];
        const isOrdered = firstItem && firstItem.ordered;
        const itemTexts = items.map(i => i.text).filter(Boolean);
        
        // Only include lists with substantial content
        if (itemTexts.length >= 3 || itemTexts.some(text => text.length > 20)) {
            return {
                title: `${isOrdered ? 'Ordered' : 'Unordered'} List`,
                type: 'list',
                depth: 1,
                line: location().start.line,
                column: location().start.column,
                children: [],
                metadata: {
                    ordered: isOrdered,
                    itemCount: itemTexts.length,
                    items: itemTexts.slice(0, 3) // Preview first 3 items
                }
            };
        }
        return null;
    }

listItem
    = " "* marker:(orderedMarker / unorderedMarker) " " content:listContent "\n"? {
        return {
            ordered: marker.ordered,
            text: content
        };
    }

orderedMarker = [0-9]+ "." { return { ordered: true }; }
unorderedMarker = [-*+] { return { ordered: false }; }
listContent = chars:(!"\n" .)* { return chars.map(c => c[1]).join('').trim(); }

// OTHER ELEMENTS - Very selective inclusion
horizontalRule
    = ("---" "-"* / "***" "*"* / "___" "_"*) "\n"? {
        return {
            title: 'Section Break',
            type: 'horizontal_rule',
            depth: 1,
            line: location().start.line,
            column: location().start.column,
            children: [],
            metadata: {}
        };
    }

blockquote
    = ">" " "* content:quoteContent+ "\n"? {
        const text = content.join(' ').trim();
        
        // Only include substantial blockquotes
        if (text.length > 30) {
            const title = text.length > 40 ? text.substring(0, 37) + '...' : text;
            return {
                title: `Quote: ${title}`,
                type: 'blockquote',
                depth: 1,
                line: location().start.line,
                column: location().start.column,
                children: [],
                metadata: {
                    content: text
                }
            };
        }
        return null;
    }

quoteContent = chars:(!"\n" .">" .)* { return chars.map(c => c[2]).join('').trim(); }

// PARAGRAPHS - Only very significant ones
paragraph
    = !(header / altHeader / table / codeBlock / list / horizontalRule / blockquote)
      content:paragraphContent {
        const text = content.trim();
        
        // Only include paragraphs that look like section introductions
        if (text.length > 100 && /^[A-Z]/.test(text)) {
            const title = text.substring(0, 47) + '...';
            return {
                title: title,
                type: 'paragraph',
                depth: 1,
                line: location().start.line,
                column: location().start.column,
                children: [],
                metadata: {
                    content: text,
                    significant: true
                }
            };
        }
        return null;
    }

paragraphContent = chars:(!"\n" .)+ "\n"? { return chars.map(c => c[1]).join(''); }

// CONTENT PARSING
headerContent = chars:(!"\n" .)+ { return chars.map(c => c[1]).join(''); }

// SKIP PATTERNS
skipLine 
    = "\n" { return null; }
    / " "* "\n" { return null; }
    / .+ "\n"? { return null; } // Skip everything else

// UTILITY FUNCTIONS
{
    function extractText(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.join('');
        return String(content);
    }
    
    function buildHierarchy(nodes) {
        const result = [];
        const stack = [];
        
        for (const node of nodes) {
            if (node.type === 'heading') {
                // Find correct parent in stack
                while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
                    stack.pop();
                }
                
                if (stack.length === 0) {
                    // Top level
                    result.push(node);
                } else {
                    // Child of previous header
                    const parent = stack[stack.length - 1];
                    if (!parent.children) parent.children = [];
                    parent.children.push(node);
                }
                
                stack.push(node);
            } else {
                // Non-header elements go to current section or top level
                if (stack.length > 0) {
                    const parent = stack[stack.length - 1];
                    if (!parent.children) parent.children = [];
                    parent.children.push(node);
                } else {
                    result.push(node);
                }
            }
        }
        
        return result;
    }
    
    function generateId(title, type, line) {
        const cleanTitle = title.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return `${type}-${cleanTitle}-${line}`;
    }
    
    function createAnchor(title) {
        return title
            .toLowerCase()
            .replace(/[^\\w\\s-]/g, '')
            .replace(/\\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
