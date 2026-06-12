; Class / struct / enum / extension all parse as class_declaration (keyword differs)
(class_declaration name: (type_identifier) @name) @definition.class
(protocol_declaration name: (type_identifier) @name) @definition.protocol

; Functions / methods / initializers / protocol requirements
(function_declaration name: (simple_identifier) @name) @definition.function
(protocol_function_declaration name: (simple_identifier) @name) @definition.function
(init_declaration "init" @name) @definition.function

; Properties and enum cases
(property_declaration name: (pattern bound_identifier: (simple_identifier) @name)) @definition.property
(enum_entry name: (simple_identifier) @name) @definition.enum-value
