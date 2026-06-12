; Package & imports
(package_declaration (scoped_identifier) @name) @definition.package
(import_declaration (scoped_identifier) @name) @definition.import

; Types
(class_declaration name: (identifier) @name) @definition.class
(interface_declaration name: (identifier) @name) @definition.interface
(enum_declaration name: (identifier) @name) @definition.enum
(annotation_type_declaration name: (identifier) @name) @definition.annotation

; Enum constants
(enum_constant name: (identifier) @name) @definition.enum-value

; Members (methods/constructors reclassified to method inside a class/interface)
(method_declaration name: (identifier) @name) @definition.function
(constructor_declaration name: (identifier) @name) @definition.function
(field_declaration declarator: (variable_declarator name: (identifier) @name)) @definition.field
