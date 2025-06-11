const Parser = require('tree-sitter');
const Markdown = require('tree-sitter-markdown');

const p = new Parser();
p.setLanguage(Markdown);