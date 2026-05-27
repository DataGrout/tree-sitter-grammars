# tree-sitter-grammars

MIT-licensed tree-sitter grammars maintained by [DataGrout](https://datagrout.ai), consumed by
[invariant](https://github.com/DataGrout/invariant) (the multi-language semantic code analyzer).

## Scope

This repo holds **only grammars we genuinely need to own** — i.e. where no
permissively licensed grammar exists. It is deliberately small.

- **Analyzers do not live here.** Turning a parse tree into facts is
  invariant's job (`analyze_*` in `invariant-core`). This repo is grammar
  source only.
- **We don't re-publish grammars that already exist under a permissive
  license.** When invariant needs a language that already has a good MIT/Apache
  grammar (Lua, Kotlin, Swift, …), it depends on that crate directly; we don't
  fork it here.

In practice that leaves one grammar today: Prolog — because the most complete
community grammar (`foxy/tree-sitter-prolog`) is **AGPL-3.0**, which can't ship
inside a proprietary, network-served product. So we maintain an MIT one.

## Grammars

| Grammar | Status | License | Notes |
|---------|--------|---------|-------|
| [`tree-sitter-prolog`](./tree-sitter-prolog) | usable | MIT | Superset: ISO core + SWI dicts + ProbLog `::` + DCG. Parses all 92 `.pl` files under `data-grout` as well as all [logic-batteries](https://github.com/DataGrout/logic-batteries) with zero errors. Corpus + Rust test suites. |

### Design principle (Prolog)

ONE superset grammar, not separate SWI/Scryer dialects. The shared ISO core is
~95% of any file; SWI adds only dict/quasi-quote *syntax* (modeled as optional
nodes), and Scryer adds no syntax SWI lacks. The single maintenance pole is the
static operator table, since tree-sitter cannot model Prolog's runtime-definable
`op/3` precedence — we approximate a superset of the ISO + common SWI/CLP(FD)
operators. Strict-dialect lints (e.g. "reject SWI dicts for an ISO namespace")
are a pass over the parse tree downstream, never a separate grammar.

## Regenerating a grammar

The generated `src/parser.c` is committed, so **consumers need no Node/npm
toolchain** — the Rust crate builds via `cc`. `tree-sitter-cli` is only needed
to regenerate after editing `grammar.js`:

```sh
cd tree-sitter-prolog
tree-sitter generate --abi 14   # ABI 14 matches tree-sitter 0.24 (invariant's runtime)
tree-sitter test                # corpus tests
cargo test                      # Rust binding + parse battery
```
