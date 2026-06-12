; Includes / imports
(preproc_include path: (_) @name) @definition.include

; Namespaces
(namespace_definition name: (namespace_identifier) @name) @definition.namespace

; Type definitions
(class_specifier name: (type_identifier) @name) @definition.class
(struct_specifier name: (type_identifier) @name) @definition.struct
(union_specifier name: (type_identifier) @name) @definition.union
(enum_specifier name: (type_identifier) @name) @definition.enum

; Function & method definitions (with a body)
(function_definition
  declarator: (function_declarator declarator: (identifier) @name)) @definition.function
(function_definition
  declarator: (function_declarator declarator: (field_identifier) @name)) @definition.function
(function_definition
  declarator: (function_declarator declarator: (qualified_identifier) @name)) @definition.function

; Free-function and constructor declarations (prototypes)
(declaration
  declarator: (function_declarator declarator: (identifier) @name)) @definition.function

; In-class method declarations
(field_declaration
  declarator: (function_declarator declarator: (field_identifier) @name)) @definition.function

; Member fields
(field_declaration
  declarator: (field_identifier) @name) @definition.field
