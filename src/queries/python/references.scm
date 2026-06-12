; Reference edges for the symbol API (calls + imports).

; Call sites: foo(...) and obj.method(...)
(call function: (identifier) @reference.call)
(call function: (attribute attribute: (identifier) @reference.call))

; Imports: import os / from pkg.sub import x
(import_statement name: (dotted_name) @reference.import)
(import_from_statement module_name: (dotted_name) @reference.import)
