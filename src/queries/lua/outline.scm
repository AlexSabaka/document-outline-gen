; Plain and local function statements
(function_definition_statement name: (identifier) @name) @definition.function
(local_function_definition_statement name: (identifier) @name) @definition.function

; Table functions: function M.foo() / function M:foo()
(function_definition_statement name: (variable field: (identifier) @name)) @definition.function
(function_definition_statement name: (variable method: (identifier) @name)) @definition.function
