# tree-sitter-tsql

[![crates.io](https://img.shields.io/crates/v/tree-sitter-tsql.svg)](https://crates.io/crates/tree-sitter-tsql)
[![docs.rs](https://img.shields.io/docsrs/tree-sitter-tsql)](https://docs.rs/tree-sitter-tsql)
[![license](https://img.shields.io/crates/l/tree-sitter-tsql.svg)](./LICENSE)

An MIT-licensed [tree-sitter](https://tree-sitter.github.io/) grammar for
**T-SQL**, the SQL of SQL Server and Azure SQL, maintained by DataGrout.

It is built for **extracting structure from real scripts**, not for validating
them. Routines (procedures, functions, views, triggers), tables, batches,
control flow and the data statements have explicit rules. What is inside a
statement (expressions, options, hints) is a permissive token stream, so
syntax the grammar does not model still parses, and the statements around it
are unaffected.

## Why a new grammar?

The generic SQL grammars cannot read T-SQL: batch separators, procedural
blocks, `EXEC`, `@variables` and optional semicolons. On SQL Server's own
open-source projects the most used one leaves 65–91% of the source under
error nodes. This grammar leaves under 1.2%:

| corpus | files | files with errors | bytes under errors |
|---|---|---|---|
| tSQLt | 281 | 3.2% | 1.17% |
| First Responder Kit | 33 | 3.0% | 0.00% |
| Wide World Importers (SSDT) | 336 | 0% | 0% |

## How statements end

T-SQL makes semicolons optional, so a statement ends where the next one
begins: at a statement keyword (`SELECT`, `SET`, `IF`, `END` …). Keywords are
contextual. A word is a keyword only where one can appear, and a longer name
wins (`end_time` is a name, not `END` and `_time`). `IF c s ELSE t` and
`IF c s; ELSE t` both parse.

## Usage (Rust)

```rust
let code = "CREATE PROCEDURE dbo.Touch @id int AS UPDATE dbo.Items SET Seen = 1 WHERE Id = @id\nGO\n";
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_tsql::LANGUAGE.into())
    .expect("Error loading T-SQL parser");
let tree = parser.parse(code, None).unwrap();
assert!(!tree.root_node().has_error());
```

## Not modelled

Nested `/* /* */ */` comments, a procedure call without `EXEC` as the first
statement of a batch, and template placeholders (`<name, type, default>`).

## License

MIT
