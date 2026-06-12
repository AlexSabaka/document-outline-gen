; Types
(struct_item name: (type_identifier) @name) @definition.struct
(enum_item name: (type_identifier) @name) @definition.enum
(enum_variant name: (identifier) @name) @definition.enum-value
(trait_item name: (type_identifier) @name) @definition.trait
(impl_item type: (type_identifier) @name) @definition.impl
(mod_item name: (identifier) @name) @definition.module

; Functions / methods (reclassified to method inside impl/trait)
(function_item name: (identifier) @name) @definition.function
(function_signature_item name: (identifier) @name) @definition.function

; Struct fields and constants
(field_declaration name: (field_identifier) @name) @definition.field
(const_item name: (identifier) @name) @definition.constant
