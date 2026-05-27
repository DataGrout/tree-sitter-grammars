//! This crate provides Prolog language support for the [tree-sitter] parsing
//! library.
//!
//! Typically, you will use the [`LANGUAGE`] constant to add this language to a
//! tree-sitter [`Parser`], and then use the parser to parse some code:
//!
//! ```
//! let code = r#"
//!     greet(World) :- format("Hello, ~w!~n", [World]).
//! "#;
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_prolog::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading Prolog parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [`Parser`]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_prolog() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_prolog) };

/// The content of the [`node-types.json`] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// The syntax highlighting query for this grammar.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

#[cfg(test)]
mod tests {
    use tree_sitter::{Node, Parser};

    fn parser() -> Parser {
        let mut p = Parser::new();
        p.set_language(&super::LANGUAGE.into())
            .expect("Error loading Prolog parser");
        p
    }

    fn parse_ok(src: &str) {
        let tree = parser().parse(src, None).unwrap();
        let root = tree.root_node();
        assert!(
            !root.has_error(),
            "unexpected parse error in:\n{src}\n--- tree ---\n{}",
            root.to_sexp()
        );
    }

    #[test]
    fn test_can_load_grammar() {
        parse_ok("room_connected(A, B) :- relation(A, connects_to, B).");
    }

    /// Breadth battery: every snippet must parse with zero error nodes. This is
    /// the low-brittleness safety net (structure is locked by the corpus tests).
    #[test]
    fn parses_without_errors_across_constructs() {
        let snippets = [
            // facts & arities
            "p.",
            "p(a).",
            "relation(entrance, connects_to, hall).",
            "edge(a, b). edge(b, c).",
            // rules & bodies
            "q(X) :- p(X).",
            "r(X) :- p(X), q(X) ; s(X).",
            "ite(X) :- ( p(X) -> q(X) ; r(X) ).",
            "softcut(X) :- ( p(X) *-> q(X) ; r(X) ).",
            "neg(X) :- \\+ member(X, []).",
            "cuts(X) :- p(X), !, q(X).",
            // arithmetic / precedence
            "a(X) :- X is 1 + 2 * 3 - 4 // 2.",
            "b :- 1 + 2 =:= 3, 2 ** 10 > 1000, X = -1.",
            "c(X, Y) :- X =< Y, X @< Y, X == Y, X \\== Y.",
            // clpfd
            "d(X) :- X in 1..9, X #> 3, X #= 5.",
            // lists
            "e([]).",
            "f([H|T]) :- g(H), f(T).",
            "h([a, b, c | Rest]).",
            "nested([[1, 2], [3, 4]]).",
            // strings, numbers, char codes, escapes
            "i(\"a string\", `back`, 0'a, 0xFF, 0o17, 0b1010, 3.14, 6.02e23, 1e-9).",
            "j('quoted atom', 'it''s escaped').",
            // negation-as-failure, anonymous vars
            "k(_, _Ignored, X) :- p(X).",
            // operators as atoms / functors
            "allowed(=). allowed(is). allowed(\\=). allowed(@<).",
            "paren(X) :- X = (<).",
            "tagged(@(true)). tagged(@(false)).",
            // SWI dicts + access + method calls
            "report(R) :- R = _{ok: true, count: 3}.",
            "field(D, V) :- V = D.key.",
            "method(D, E) :- E = D.put(_{a: 1}).",
            "chain(D, V) :- V = D.a.b.c.",
            // DCG
            "greeting --> [hello], [world].",
            "digits([D|T]) --> digit(D), digits(T).",
            "opt --> ( [a] ; [] ).",
            "with_action --> [x], { writeln(saw_x) }.",
            // directives
            ":- module(m, [a/1, b/2, c/0]).",
            ":- use_module(library(lists)).",
            ":- use_module('relative/path.pl').",
            ":- dynamic counter/1.",
            ":- discontiguous foo/2.",
            ":- initialization(main).",
            ":- table ancestor/2.",
            "?- solve(X).",
            // module-qualified calls
            "mq(X) :- lists:member(X, [1, 2, 3]).",
            // ProbLog
            "0.3::rains.",
            "0.5::heads ; 0.5::tails.",
            "0.7::wet :- rains.",
            // comments are extras
            "% a line comment\nafter_comment(ok).",
            "/* block\n comment */ after_block(ok).",
            // findall / meta with parenthesized goal arg
            "count(N) :- findall(X, member(X, [1, 2, 3]), L), length(L, N).",
        ];
        for s in snippets {
            parse_ok(s);
        }
    }

    /// Depth-first search for the first node of `kind`.
    fn find<'a>(node: Node<'a>, kind: &str) -> Option<Node<'a>> {
        if node.kind() == kind {
            return Some(node);
        }
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if let Some(found) = find(child, kind) {
                return Some(found);
            }
        }
        None
    }

    fn field_text<'a>(node: Node<'a>, field: &str, src: &'a str) -> String {
        node.child_by_field_name(field)
            .map(|n| n.utf8_text(src.as_bytes()).unwrap().to_string())
            .unwrap_or_default()
    }

    #[test]
    fn structure_rule_head_operator_body() {
        let src =
            "room_accessible(P, R) :- attribute(R, requires_key, K), relation(P, has_item, K).";
        let tree = parser().parse(src, None).unwrap();
        let bin = find(tree.root_node(), "binary_operation").unwrap();
        assert_eq!(field_text(bin, "operator", src), ":-");
        let head = bin.child_by_field_name("left").unwrap();
        assert_eq!(head.kind(), "compound_term");
        assert_eq!(field_text(head, "functor", src), "room_accessible");
        // body root is the conjunction
        let body = bin.child_by_field_name("right").unwrap();
        assert_eq!(body.kind(), "binary_operation");
        assert_eq!(field_text(body, "operator", src), ",");
    }

    #[test]
    fn structure_dict_and_access() {
        let src = "f(D) :- X = D.key, Y = _{a: 1}.";
        let tree = parser().parse(src, None).unwrap();
        let root = tree.root_node();
        assert!(find(root, "dict").is_some(), "dict node missing");
        assert!(
            find(root, "dict_access").is_some(),
            "dict_access node missing"
        );
    }

    #[test]
    fn structure_problog_annotation() {
        let src = "0.5::heads :- toss.";
        let tree = parser().parse(src, None).unwrap();
        let top = find(tree.root_node(), "binary_operation").unwrap();
        assert_eq!(field_text(top, "operator", src), ":-");
        // left is the `::` annotation
        let left = top.child_by_field_name("left").unwrap();
        assert_eq!(field_text(left, "operator", src), "::");
    }

    #[test]
    fn structure_directive_is_unary() {
        let src = ":- module(m, [a/1]).";
        let tree = parser().parse(src, None).unwrap();
        let un = find(tree.root_node(), "unary_operation").unwrap();
        assert_eq!(field_text(un, "operator", src), ":-");
        let operand = un.child_by_field_name("operand").unwrap();
        assert_eq!(operand.kind(), "compound_term");
        assert_eq!(field_text(operand, "functor", src), "module");
    }
}
