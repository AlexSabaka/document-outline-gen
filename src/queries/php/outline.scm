; Namespace and types
(namespace_definition name: (namespace_name) @name) @definition.namespace
(interface_declaration name: (name) @name) @definition.interface
(class_declaration name: (name) @name) @definition.class
(trait_declaration name: (name) @name) @definition.trait

; Methods / functions (reclassified to method inside a class/interface/trait)
(method_declaration name: (name) @name) @definition.function
(function_definition name: (name) @name) @definition.function

; Properties
(property_declaration (property_element (variable_name (name) @name))) @definition.property
