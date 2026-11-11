//! This crate provides T-SQL (SQL Server, Azure SQL) language support for the
//! [tree-sitter] parsing library.
//!
//! The grammar is built for extracting structure from real scripts:
//! routines, tables, control flow and the data statements have explicit
//! rules, and what is inside a statement is a permissive token stream.
//!
//! ```
//! let code = "CREATE PROCEDURE dbo.Touch @id int AS UPDATE dbo.Items SET Seen = 1 WHERE Id = @id\nGO\n";
//! let mut parser = tree_sitter::Parser::new();
//! parser
//!     .set_language(&tree_sitter_tsql::LANGUAGE.into())
//!     .expect("Error loading T-SQL parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_tsql() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_tsql) };

/// The content of the [`node-types.json`] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");
