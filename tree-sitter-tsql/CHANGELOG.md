# Changelog

## [0.1.0] - 2026-11-10

First release.

- Routines (`CREATE [OR ALTER] PROCEDURE | FUNCTION | VIEW | TRIGGER`), with
  parameters, header options (`WITH EXECUTE AS OWNER`, `NATIVE_COMPILATION`),
  CLR bodies (`EXTERNAL NAME`) and bodies running to the end of the batch.
- `CREATE TABLE`, `DROP … [IF EXISTS]`, batches (`GO [n]`), SQLCMD
  `:commands` and `$(variables)`.
- Control flow: `BEGIN … END`, `BEGIN ATOMIC WITH (…)`, `IF … [;] ELSE`,
  `WHILE`, `BEGIN TRY … END TRY BEGIN CATCH … END CATCH`, transactions, labels.
- Data statements: `SELECT` (with set operators), `INSERT … VALUES | SELECT |
  EXEC`, `UPDATE`, `DELETE`, `MERGE`, common table expressions (and `WITH
  XMLNAMESPACES`), `EXEC[UTE]`, `DECLARE` (cursors and table variables).
- Inside a statement, a permissive token stream: names (`[dbo].[t]`,
  `db..t`, `#temp`, `@var`), literals, operators, parentheses and
  `CASE … END`.

Measured on SQL Server open source (tSQLt, the First Responder Kit, Wide World
Importers SSDT): 96.8%, 97.0% and 100% of files parse without errors, under
1.2% of bytes in any set.
