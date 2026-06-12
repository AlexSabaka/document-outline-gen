; Classes / interfaces (interface is a class_declaration with an `interface` keyword)
(class_declaration (type_identifier) @name) @definition.class
(object_declaration (type_identifier) @name) @definition.object

; Functions / methods (reclassified to method inside a class/interface/object)
(function_declaration (simple_identifier) @name) @definition.function

; Properties
(property_declaration (variable_declaration (simple_identifier) @name)) @definition.property
