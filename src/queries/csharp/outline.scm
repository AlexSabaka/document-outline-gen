; Namespaces (block-scoped + file-scoped)
(namespace_declaration name: (_) @name) @definition.namespace
(file_scoped_namespace_declaration name: (_) @name) @definition.namespace

; Types
(class_declaration name: (identifier) @name) @definition.class
(struct_declaration name: (identifier) @name) @definition.struct
(interface_declaration name: (identifier) @name) @definition.interface
(enum_declaration name: (identifier) @name) @definition.enum

; Enum members
(enum_member_declaration name: (identifier) @name) @definition.enum-value

; Members (methods/constructors reclassified to method inside a type)
(method_declaration name: (identifier) @name) @definition.function
(constructor_declaration name: (identifier) @name) @definition.function
(property_declaration name: (identifier) @name) @definition.property
(field_declaration
  (variable_declaration (variable_declarator (identifier) @name))) @definition.field
