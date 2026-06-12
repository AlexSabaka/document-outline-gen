; TOML outline captures.
;
; Tables and array-of-tables are flat siblings in the AST; TomlGenerator
; reparents dotted sub-tables ([a.b] under [a]) in a post-pass. Pairs nest
; under their enclosing table via real AST containment.

; [section] / [section.sub]
(table (bare_key) @name) @definition.table
(table (dotted_key) @name) @definition.table

; [[array-of-tables]]
(table_array_element (bare_key) @name) @definition.table-array
(table_array_element (dotted_key) @name) @definition.table-array

; key = value
(pair (bare_key) @name) @definition.key
(pair (dotted_key) @name) @definition.key
(pair (quoted_key) @name) @definition.key
