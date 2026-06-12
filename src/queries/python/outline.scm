; Classes
(class_definition name: (identifier) @name) @definition.class

; Functions and methods. The inner function_definition is matched even when
; wrapped in a decorated_definition, so decorated and async defs need no
; special pattern.
(function_definition name: (identifier) @name) @definition.function

; Class-level attributes -> properties (annotated or plain assignments whose
; target is a bare name; `self.x = ...` has an attribute target and is skipped).
(class_definition
  body: (block
    (expression_statement
      (assignment left: (identifier) @name) @definition.property)))
