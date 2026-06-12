; Classes (concrete + abstract)
(class_declaration name: (type_identifier) @name) @definition.class
(abstract_class_declaration name: (type_identifier) @name) @definition.class

; Interfaces, type aliases, enums
(interface_declaration name: (type_identifier) @name) @definition.interface
(type_alias_declaration name: (type_identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.enum

; Top-level functions
(function_declaration name: (identifier) @name) @definition.function

; Methods (concrete + abstract); reclassified to method inside a class
(method_definition name: (property_identifier) @name) @definition.function
(abstract_method_signature name: (property_identifier) @name) @definition.function

; Class fields -> property
(public_field_definition name: (property_identifier) @name) @definition.property

; const fn = () => {} / const fn = function () {} -> function
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: [(arrow_function) (function_expression)])) @definition.function
