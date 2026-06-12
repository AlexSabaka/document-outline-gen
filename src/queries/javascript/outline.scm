; Classes
(class_declaration name: (identifier) @name) @definition.class

; Top-level functions
(function_declaration name: (identifier) @name) @definition.function

; Methods (reclassified to method inside a class)
(method_definition name: (property_identifier) @name) @definition.function

; Class fields -> property
(field_definition property: (property_identifier) @name) @definition.property

; const fn = () => {} / const fn = function () {}
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: [(arrow_function) (function_expression)])) @definition.function

; CommonJS / prototype: exports.x = fn, obj.method = () => {}
(expression_statement
  (assignment_expression
    left: (member_expression property: (property_identifier) @name)
    right: [(arrow_function) (function_expression)])) @definition.function
