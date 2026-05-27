# Changelog

All notable changes to `tree-sitter-prolog` are documented here.

This project follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] - 2026-05-27

Initial release.

### Added

- **Superset Prolog grammar** — ISO core (clauses, `Head :- Body`, an
  operator-precedence tower over a static superset of the ISO + common
  SWI/CLP(FD) operator table, lists, strings, char codes, numbers incl.
  `0x`/`0o`/`0b`/float/exponent, comments) plus the SWI/extension syntax that
  appears in real code:
  - **SWI dicts** — `_{k: v}` / `Tag{...}` (dedicated `dict` node).
  - **Dict access** — `Dict.key` field access and `Dict.method(Args)` calls,
    disambiguated from the clause terminator via an immediate `.key` token.
  - **ProbLog** — annotated clauses `0.5::heads :- toss.` (`::` operator).
  - **DCG** — `Head --> Body`.
  - **Operators as atoms / functors** — `(<)`, `lc_allowed_predicate(=)`,
    `@(true)`.
  - **Directives** — `:- module/use_module/dynamic/discontiguous/...`,
    `?-` queries.
- **Rust binding** — `LANGUAGE: LanguageFn`, `NODE_TYPES`, `HIGHLIGHTS_QUERY`.
  Builds via `cc` (no Node/npm needed by consumers; the generated `parser.c`
  is committed). Generated at ABI 14 for compatibility with the `tree-sitter`
  0.24 runtime.
- **Highlight query** — `queries/highlights.scm`.
- **Tests** — `test/corpus/*.txt` structural corpus + a Rust parse battery and
  structural assertions in the binding.

### Validation

- Parses **all 92** Prolog files under `data-grout/priv` and `logic-batteries`
  with **zero error nodes**, including the 2673-line `logic_cell.pl`.

### Notes

- Dialect detection (ISO-conformance, SWI-only constructs, ProbLog) is
  intentionally a downstream concern (e.g. DataGrout's `IsoConformance`), not
  the grammar's — this is a single superset grammar by design.
- Not yet published to crates.io; consumed by `invariant` as a path dependency.
