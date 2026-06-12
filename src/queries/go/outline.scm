; Types
(type_spec name: (type_identifier) @name type: (struct_type)) @definition.struct
(type_spec name: (type_identifier) @name type: (interface_type)) @definition.interface

; Functions and (receiver) methods — both top-level in Go
(function_declaration name: (identifier) @name) @definition.function
(method_declaration name: (field_identifier) @name) @definition.method

; Struct fields and interface method specs nest under their type
(field_declaration name: (field_identifier) @name) @definition.field
(method_spec name: (field_identifier) @name) @definition.method

; Constants
(const_declaration (const_spec name: (identifier) @name)) @definition.constant
