; Modules and classes
(module name: (constant) @name) @definition.module
(class name: (constant) @name) @definition.class

; Methods (reclassified to method inside a class/module)
(method name: (identifier) @name) @definition.function
(singleton_method name: (identifier) @name) @definition.function
