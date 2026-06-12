; Classes / objects / traits
(class_definition name: (identifier) @name) @definition.class
(object_definition name: (identifier) @name) @definition.object
(trait_definition name: (identifier) @name) @definition.trait

; Methods (definitions with body + abstract declarations)
(function_definition name: (identifier) @name) @definition.function
(function_declaration name: (identifier) @name) @definition.function
