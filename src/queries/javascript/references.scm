; Reference edges for the symbol API (calls + imports).

; Call sites: foo(...) and obj.method(...)
(call_expression
  function: (identifier) @reference.call)
(call_expression
  function: (member_expression
    property: (property_identifier) @reference.call))

; Imports: the module specifier (without quotes)
(import_statement
  source: (string (string_fragment) @reference.import))
