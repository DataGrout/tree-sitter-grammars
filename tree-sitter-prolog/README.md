# tree-sitter-prolog

[![crates.io](https://img.shields.io/crates/v/tree-sitter-prolog.svg)](https://crates.io/crates/tree-sitter-prolog)
[![docs.rs](https://img.shields.io/docsrs/tree-sitter-prolog)](https://docs.rs/tree-sitter-prolog)
[![license](https://img.shields.io/crates/l/tree-sitter-prolog.svg)](./LICENSE)

An MIT-licensed [tree-sitter](https://tree-sitter.github.io/) grammar for
**Prolog**, maintained by DataGrout.

It is a **superset** grammar: the ISO core plus the SWI / extension syntax that
shows up in real code — SWI dicts (`_{k: v}`), dict access (`D.key`,
`D.put(X)`), ProbLog annotations (`0.5::heads`), DCG (`-->`), operators used as
atoms (`(<)`, `foo(=)`), and the usual directives. Dialect detection (ISO vs
SWI-only, ProbLog, etc.) is left to downstream tooling — there is one grammar,
not a SWI/Scryer fork.

It's battle-tested against thousands of lines of real-world SWI/ISO Prolog —
including large multi-thousand-line modules — with zero parse errors.

## Why a new grammar?

The most complete community grammar (`foxy/tree-sitter-prolog`) is **AGPL-3.0**,
which can't ship inside a proprietary, network-served product. This one is MIT.

## Usage (Rust)

```rust
let code = "room_connected(A, B) :- relation(A, connects_to, B).";
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_prolog::LANGUAGE.into())
    .expect("loading Prolog grammar");
let tree = parser.parse(code, None).unwrap();
assert!(!tree.root_node().has_error());
```

The generated `src/parser.c` is committed, so **consumers need no Node/npm
toolchain** — the crate builds via `cc`. The grammar is generated at tree-sitter
ABI 14 (compatible with the `tree-sitter` 0.24 runtime).

## Node shape (for analyzer authors)

- A clause is `(clause term: <term>)`, terminated by `.`.
- Rules / DCG / ProbLog: `(binary_operation left: … operator: ":-"|"-->"|"::" right: …)`.
- Directives: `(unary_operation operator: ":-"|"?-" operand: …)`.
- Calls: a `compound_term` has `functor:` + `argument:` fields; body goals are
  reached by recursing through the control operators `, ; -> *-> |`.
- SWI dicts: `(dict tag: … pair: (dict_pair key: … value: …))`;
  access: `(dict_access object: … (dict_access_key key: …))`.

## Development

```sh
tree-sitter generate --abi 14   # regenerate src/parser.c from grammar.js
tree-sitter test                # corpus tests (test/corpus/)
cargo test                      # Rust binding + parse battery
```

## License

MIT. See [LICENSE](./LICENSE).
