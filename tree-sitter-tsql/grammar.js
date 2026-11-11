/**
 * @file T-SQL (SQL Server / Azure SQL) grammar for tree-sitter
 * @license MIT
 *
 * Built for extracting structure from real scripts, not for validating
 * them. Statements, routines (procedures, functions, views, triggers),
 * tables, control flow and the data statements have explicit rules; what is
 * inside a statement (expressions, options, hints) is a permissive token
 * stream, so syntax this grammar does not model still parses. Statement
 * boundaries come from keywords, since T-SQL makes semicolons optional:
 * keywords are contextual, so a word is a keyword only where one can start.
 */

// Case-insensitive keywords, each defined once as a rule so every use of a
// word is the same token: SELECT, select, Select.
const KEYWORDS = [
  'CONVERSATION',
  'DIALOG',
  'ATOMIC',
  'NAME',
  'EXTERNAL',
  'EXISTS',
  'AFTER',
  'ALL',
  'ALTER',
  'AS',
  'BACKUP',
  'BEGIN',
  'BREAK',
  'BULK',
  'CASE',
  'CATCH',
  'CHECKPOINT',
  'CLOSE',
  'COMMIT',
  'CONTINUE',
  'CREATE',
  'DATABASE',
  'DBCC',
  'DEALLOCATE',
  'DECLARE',
  'DEFAULT',
  'DELETE',
  'DENY',
  'DISABLE',
  'DISTRIBUTED',
  'DROP',
  'ELSE',
  'ENABLE',
  'END',
  'EXCEPT',
  'EXEC',
  'EXECUTE',
  'FETCH',
  'FOR',
  'FROM',
  'FUNCTION',
  'GO',
  'GOTO',
  'GRANT',
  'IF',
  'INSERT',
  'INSTEAD',
  'INTERSECT',
  'INTO',
  'KILL',
  'MERGE',
  'OF',
  'ON',
  'OPEN',
  'OR',
  'PERCENT',
  'PRINT',
  'PROC',
  'PROCEDURE',
  'RAISERROR',
  'READTEXT',
  'RECONFIGURE',
  'RESTORE',
  'RETURN',
  'RETURNS',
  'REVERT',
  'REVOKE',
  'ROLLBACK',
  'SAVE',
  'SELECT',
  'SERVER',
  'SET',
  'SETUSER',
  'SHUTDOWN',
  'TABLE',
  'THEN',
  'THROW',
  'TOP',
  'TRAN',
  'TRANSACTION',
  'TRIGGER',
  'TRUNCATE',
  'TRY',
  'UNION',
  'UPDATE',
  'UPDATETEXT',
  'USE',
  'VALUES',
  'VIEW',
  'WAITFOR',
  'WHEN',
  'WHILE',
  'WITH',
  'WRITETEXT',
];

function kwRegex(word) {
  return new RegExp(
    word
      .split('')
      .map((c) => (/[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c))
      .join(''),
  );
}

const keywordRules = Object.fromEntries(
  KEYWORDS.map((w) => [`_kw_${w.toLowerCase()}`, (_) => token(kwRegex(w))]),
);

const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)));

module.exports = grammar({
  name: 'tsql',

  extras: ($) => [/\s/, /\uFEFF/, $.comment],


  conflicts: ($) => [[$.if_statement]],



  rules: {
    source_file: ($) => repeat(choice($.batch_separator, $.sqlcmd_command, $._statement, ';')),

    // Keywords come before every other token rule: a word that is both a
    // keyword and a name, at the same length, is the keyword where a keyword
    // can appear. A longer name still wins (`end_time` is not END + `_time`).
    ...keywordRules,

    // ── Lexical ───────────────────────────────────────────────────────────

    comment: (_) =>
      token(choice(seq('--', /[^\r\n]*/), seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'))),

    _word: (_) => /[\p{L}_][\p{L}\p{N}_$#@]*/u,

    identifier: ($) => $._word,

    bracketed_identifier: (_) => /\[([^\]]|\]\])*\]/,

    quoted_identifier: (_) => /"([^"]|"")*"/,

    temp_name: (_) => /##?[\p{L}\p{N}_$#@]+/u,

    variable: (_) => /@@?[\p{L}\p{N}_$#@]+/u,

    // SQLCMD: $(Name) in SSDT and deployment scripts.
    sqlcmd_variable: (_) => /\$\([^)\r\n]*\)/,

    // :setvar, :r and the like, alone on a line.
    sqlcmd_command: (_) => token(prec(-1, /:[a-zA-Z]+[^\r\n]*/)),

    string: (_) => /[nN]?'([^']|'')*'/,

    number: (_) => /\d+(\.\d*)?([eE][-+]?\d+)?|\.\d+([eE][-+]?\d+)?|0[xX][0-9a-fA-F]*|\$\d+(\.\d*)?/,

    operator: (_) => /[-+*\/%=<>!&|^~:]+/,

    // GO [count]: ends a batch. Not T-SQL itself; sqlcmd and SSMS split on it.
    batch_separator: ($) => prec.right(seq(alias($._kw_go, 'GO'), optional($.number))),

    _name_part: ($) =>
      choice($.identifier, $.bracketed_identifier, $.quoted_identifier, $.sqlcmd_variable),

    // server.database.schema.object, any part possibly empty (db..obj). A
    // dotted name is one token: split into parts, `t.c` read as `t.` then a
    // new name `c`.
    object_name: ($) => choice($._name_part, $.dotted_name),

    dotted_name: (_) => {
      const part = /([\p{L}_][\p{L}\p{N}_$#@]*|\[([^\]]|\]\])*\]|"([^"]|"")*"|\$\([^)\r\n]*\))/u.source;
      // a.b, a.b.c, db..t, t.*; no whitespace around the dots, so the token
      // never starts with whitespace and competes with the extras.
      return token(new RegExp(`((${part})?\\.)+(${part}|\\*)`, 'u'));
    },

    _object_ref: ($) => choice($.object_name, $.temp_name, $.variable),

    // ── Token streams ─────────────────────────────────────────────────────

    _item: ($) => choice($._item_no_comma, ','),

    _item_no_comma: ($) =>
      choice(
        $.object_name,
        $.temp_name,
        $.variable,
        $.string,
        $.number,
        $.operator,
        $.parenthesized,
        $.case_expression,
        '.',
        '*',
      ),

    _items: ($) => prec.right(repeat1(choice($._item, $._soft_keyword))),

    // Keywords that never end a statement. After a name the parser is in a
    // state shared by every context a name appears in, so a word that is a
    // keyword anywhere a name can be followed (TABLE after `DECLARE @t`, AS
    // after a procedure's parameters) is lexed as that keyword everywhere.
    // Inside statements they are ordinary items.
    _soft_keyword: ($) =>
      choice(
        alias($._kw_exists, 'EXISTS'),
        alias($._kw_name, 'NAME'),
        alias($._kw_external, 'EXTERNAL'),
        alias($._kw_as, 'AS'),
        alias($._kw_table, 'TABLE'),
        alias($._kw_on, 'ON'),
        alias($._kw_of, 'OF'),
        alias($._kw_after, 'AFTER'),
        alias($._kw_instead, 'INSTEAD'),
        alias($._kw_for, 'FOR'),
        alias($._kw_with, 'WITH'),
        alias($._kw_into, 'INTO'),
        alias($._kw_from, 'FROM'),
        alias($._kw_default, 'DEFAULT'),
        alias($._kw_percent, 'PERCENT'),
        alias($._kw_top, 'TOP'),
        alias($._kw_all, 'ALL'),
        alias($._kw_or, 'OR'),
        alias($._kw_values, 'VALUES'),
        alias($._kw_when, 'WHEN'),
        alias($._kw_then, 'THEN'),
        alias($._kw_database, 'DATABASE'),
        alias($._kw_server, 'SERVER'),
        alias($._kw_returns, 'RETURNS'),
        alias($._kw_tran, 'TRAN'),
        alias($._kw_transaction, 'TRANSACTION'),
        alias($._kw_distributed, 'DISTRIBUTED'),
        alias($._kw_proc, 'PROC'),
        alias($._kw_procedure, 'PROCEDURE'),
        alias($._kw_function, 'FUNCTION'),
        alias($._kw_view, 'VIEW'),
        alias($._kw_trigger, 'TRIGGER'),
        alias($._kw_catch, 'CATCH'),
        alias($._kw_try, 'TRY'),
      ),

    // The same stream in routine headers (options, RETURNS, trigger events),
    // where AS, FOR or AFTER ends it. One rule for both would share its parse
    // states, and those words would end every SELECT too.
    _header_items: ($) =>
      prec.right(
        repeat1(
          choice(
            $._item,
            // WITH EXECUTE AS OWNER: the one AS a header option holds.
            seq(choice(alias($._kw_exec, 'EXEC'), alias($._kw_execute, 'EXECUTE')), alias($._kw_as, 'AS')),
          ),
        ),
      ),

    parenthesized: ($) =>
      seq(
        '(',
        repeat(
          choice(
            $._item,
            $._soft_keyword,
            alias($._kw_update, 'UPDATE'),
            alias($._kw_delete, 'DELETE'),
            alias($._kw_insert, 'INSERT'),
            alias($._kw_set, 'SET'),
            $.select_statement,
            $.exec_statement,
          ),
        ),
        ')',
      ),

    case_expression: ($) =>
      seq(
        alias($._kw_case, 'CASE'),
        repeat(choice($._item, $._soft_keyword, alias($._kw_else, 'ELSE'))),
        alias($._kw_end, 'END'),
      ),

    values_clause: ($) => prec.right(seq(alias($._kw_values, 'VALUES'), $._items)),

    // ── Statements ────────────────────────────────────────────────────────

    _statement: ($) =>
      choice(
        $.create_procedure,
        $.create_function,
        $.create_view,
        $.create_trigger,
        $.create_table,
        $.block,
        $.try_catch,
        $.if_statement,
        $.while_statement,
        $.exec_statement,
        $.declare_statement,
        $.select_statement,
        $.insert_statement,
        $.update_statement,
        $.delete_statement,
        $.merge_statement,
        $.with_statement,
        $.return_statement,
        $.transaction_statement,
        $.drop_statement,
        $.external_name,
        $.label,
        $.other_statement,
      ),

    // DROP TABLE [IF EXISTS] t, DROP PROCEDURE p, DROP INDEX i ON t …
    drop_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_drop, 'DROP'),
          field('kind', choice($._soft_keyword, $.identifier)),
          optional(seq(alias($._kw_if, 'IF'), alias($._kw_exists, 'EXISTS'))),
          optional($._items),
        ),
      ),

    // CLR routines: AS EXTERNAL NAME assembly.class.method
    external_name: ($) => seq(alias($._kw_external, 'EXTERNAL'), alias($._kw_name, 'NAME'), $.object_name),

    // GOTO target, alone on its line: `RegEx::Expr` and `LOGIN::[x]` are not.
    label: (_) => token(seq(/[\p{L}_][\p{L}\p{N}_$#@]*/u, ':', /[ \t]*\r?\n/)),

    _body: ($) => repeat1(choice($._statement, ';')),

    // BEGIN ATOMIC WITH (…) in natively compiled procedures.
    block: ($) =>
      seq(
        alias($._kw_begin, 'BEGIN'),
        optional(seq(alias($._kw_atomic, 'ATOMIC'), alias($._kw_with, 'WITH'), $.parenthesized)),
        optional($._body),
        alias($._kw_end, 'END'),
      ),

    try_catch: ($) =>
      seq(
        alias($._kw_begin, 'BEGIN'), alias($._kw_try, 'TRY'), optional($._body), alias($._kw_end, 'END'), alias($._kw_try, 'TRY'),
        alias($._kw_begin, 'BEGIN'), alias($._kw_catch, 'CATCH'), optional($._body), alias($._kw_end, 'END'), alias($._kw_catch, 'CATCH'),
      ),

    // `IF c s ELSE t` and `IF c s; ELSE t` are both T-SQL, so after the
    // first branch a `;` may end the IF or lead to its ELSE. The parser tries
    // both (see `conflicts`); an ELSE binds to the nearest IF.
    if_statement: ($) =>
      prec.dynamic(
        1,
        seq(
          alias($._kw_if, 'IF'),
          field('condition', $._items),
          field('then', $._statement),
          optional(seq(optional(';'), alias($._kw_else, 'ELSE'), field('else', $._statement))),
        ),
      ),

    while_statement: ($) =>
      seq(alias($._kw_while, 'WHILE'), field('condition', $._items), field('body', $._statement)),

    // EXEC proc args | EXEC @ret = proc args | EXEC (@sql) | EXECUTE AS ...
    exec_statement: ($) =>
      prec.right(
        seq(
          choice(alias($._kw_exec, 'EXEC'), alias($._kw_execute, 'EXECUTE')),
          optional(seq($.variable, '=')),
          choice(
            field('procedure', $._object_ref),
            $.parenthesized,
            seq(alias($._kw_as, 'AS'), $._header_items),
          ),
          optional($._items),
        ),
      ),

    declare_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_declare, 'DECLARE'),
          repeat1(choice($._item, alias($._kw_table, 'TABLE'), seq(alias($._kw_for, 'FOR'), $.select_statement))),
        ),
      ),

    select_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_select, 'SELECT'),
          optional($._items),
          repeat(
            seq(
              choice(seq(alias($._kw_union, 'UNION'), optional(alias($._kw_all, 'ALL'))), alias($._kw_except, 'EXCEPT'), alias($._kw_intersect, 'INTERSECT')),
              choice($.select_statement, $.parenthesized),
            ),
          ),
        ),
      ),

    insert_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_insert, 'INSERT'),
          optional($.top_clause),
          optional(alias($._kw_into, 'INTO')),
          field('table', $._object_ref),
          optional($._items),
          // VALUES (…) and DEFAULT VALUES are in the stream before.
          optional(choice($.select_statement, $.exec_statement)),
        ),
      ),

    top_clause: ($) => seq(alias($._kw_top, 'TOP'), $.parenthesized, optional(alias($._kw_percent, 'PERCENT'))),

    update_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_update, 'UPDATE'),
          optional($.top_clause),
          field('table', $._object_ref),
          optional($._items),
          optional(seq(alias($._kw_set, 'SET'), optional($._items))),
        ),
      ),

    delete_statement: ($) =>
      prec.right(
        seq(
          alias($._kw_delete, 'DELETE'),
          optional($.top_clause),
          optional(alias($._kw_from, 'FROM')),
          field('table', $._object_ref),
          optional($._items),
        ),
      ),

    // MERGE must end with ';', and its WHEN … THEN arms hold UPDATE, INSERT
    // and DELETE, so its body runs to the semicolon.
    merge_statement: ($) =>
      seq(
        alias($._kw_merge, 'MERGE'),
        optional($.top_clause),
        optional(alias($._kw_into, 'INTO')),
        field('table', $._object_ref),
        repeat(
          choice(
            $._item,
            alias($._kw_update, 'UPDATE'),
            alias($._kw_insert, 'INSERT'),
            alias($._kw_delete, 'DELETE'),
            alias($._kw_set, 'SET'),
            alias($._kw_then, 'THEN'),
            alias($._kw_when, 'WHEN'),
            alias($._kw_values, 'VALUES'),
            alias($._kw_default, 'DEFAULT'),
          ),
        ),
        ';',
      ),

    common_table_expression: ($) =>
      seq(
        field('name', choice($.identifier, $.bracketed_identifier)),
        optional($.parenthesized),
        alias($._kw_as, 'AS'),
        $.parenthesized,
      ),

    with_statement: ($) =>
      seq(
        alias($._kw_with, 'WITH'),
        // WITH XMLNAMESPACES ('uri' AS p), cte AS (…)
        commaSep1(choice($.common_table_expression, seq($.identifier, $.parenthesized))),
        choice($.select_statement, $.insert_statement, $.update_statement, $.delete_statement, $.merge_statement),
      ),

    return_statement: ($) =>
      prec.right(seq(alias($._kw_return, 'RETURN'), optional(choice($.select_statement, $._items)))),

    transaction_statement: ($) =>
      prec.right(
        seq(
          choice(
            seq(alias($._kw_begin, 'BEGIN'), optional(alias($._kw_distributed, 'DISTRIBUTED')), choice(alias($._kw_tran, 'TRAN'), alias($._kw_transaction, 'TRANSACTION'))),
            // Service Broker: BEGIN DIALOG [CONVERSATION] @h …
            seq(alias($._kw_begin, 'BEGIN'), choice(alias($._kw_dialog, 'DIALOG'), alias($._kw_conversation, 'CONVERSATION'))),
            alias($._kw_commit, 'COMMIT'),
            alias($._kw_rollback, 'ROLLBACK'),
            seq(alias($._kw_save, 'SAVE'), choice(alias($._kw_tran, 'TRAN'), alias($._kw_transaction, 'TRANSACTION'))),
          ),
          optional($._items),
        ),
      ),

    // Everything else that starts a statement: DROP, ALTER, CREATE INDEX,
    // SET, PRINT, RAISERROR, THROW, GRANT, TRUNCATE, cursors, DBCC …
    other_statement: ($) =>
      prec.right(
        seq(
          field(
            'keyword',
            choice(
              alias($._kw_set, 'SET'), alias($._kw_print, 'PRINT'), alias($._kw_raiserror, 'RAISERROR'), alias($._kw_throw, 'THROW'), alias($._kw_alter, 'ALTER'),
              alias($._kw_create, 'CREATE'), alias($._kw_truncate, 'TRUNCATE'), alias($._kw_grant, 'GRANT'), alias($._kw_deny, 'DENY'), alias($._kw_revoke, 'REVOKE'), alias($._kw_use, 'USE'),
              alias($._kw_open, 'OPEN'), alias($._kw_fetch, 'FETCH'), alias($._kw_close, 'CLOSE'), alias($._kw_deallocate, 'DEALLOCATE'), alias($._kw_bulk, 'BULK'), alias($._kw_dbcc, 'DBCC'),
              alias($._kw_checkpoint, 'CHECKPOINT'), alias($._kw_kill, 'KILL'), alias($._kw_reconfigure, 'RECONFIGURE'), alias($._kw_waitfor, 'WAITFOR'), alias($._kw_goto, 'GOTO'),
              alias($._kw_break, 'BREAK'), alias($._kw_continue, 'CONTINUE'), alias($._kw_backup, 'BACKUP'), alias($._kw_restore, 'RESTORE'), alias($._kw_enable, 'ENABLE'),
              alias($._kw_disable, 'DISABLE'), alias($._kw_revert, 'REVERT'), alias($._kw_setuser, 'SETUSER'), alias($._kw_shutdown, 'SHUTDOWN'), alias($._kw_readtext, 'READTEXT'),
              alias($._kw_writetext, 'WRITETEXT'), alias($._kw_updatetext, 'UPDATETEXT'),
            ),
          ),
          optional(
            repeat1(
              choice(
                $._item,
                $._soft_keyword,
              ),
            ),
          ),
        ),
      ),

    // ── Definitions ───────────────────────────────────────────────────────

    _create_or_alter: ($) =>
      prec(2, choice(seq(alias($._kw_create, 'CREATE'), optional(seq(alias($._kw_or, 'OR'), alias($._kw_alter, 'ALTER')))), alias($._kw_alter, 'ALTER'))),

    parameter: ($) =>
      prec.right(seq(field('name', $.variable), optional(alias($._kw_as, 'AS')), repeat($._item_no_comma))),

    parameters: ($) =>
      choice(
        seq('(', optional(commaSep1($.parameter)), ')'),
        commaSep1($.parameter),
      ),

    create_procedure: ($) =>
      prec.right(seq(
        $._create_or_alter,
        choice(alias($._kw_proc, 'PROC'), alias($._kw_procedure, 'PROCEDURE')),
        field('name', choice($.object_name, $.temp_name)),
        optional(seq(';', $.number)),
        optional(field('parameters', $.parameters)),
        optional(seq(alias($._kw_with, 'WITH'), $._header_items)),
        optional(seq(alias($._kw_for, 'FOR'), $._header_items)),
        alias($._kw_as, 'AS'),
        optional(field('body', alias($._body, $.body))),
      )),

    _function_parameters: ($) => seq('(', optional(commaSep1($.parameter)), ')'),

    create_function: ($) =>
      prec.right(seq(
        $._create_or_alter,
        alias($._kw_function, 'FUNCTION'),
        field('name', $.object_name),
        field('parameters', alias($._function_parameters, $.parameters)),
        alias($._kw_returns, 'RETURNS'),
        field(
          'returns',
          choice(
            seq(alias($._kw_table, 'TABLE'), optional($.parenthesized)),
            seq($.variable, alias($._kw_table, 'TABLE'), $.parenthesized),
            $._header_items,
          ),
        ),
        optional(seq(alias($._kw_with, 'WITH'), $._header_items)),
        optional(alias($._kw_as, 'AS')),
        // BEGIN … END, RETURN … (inline), or EXTERNAL NAME (CLR).
        optional(field('body', choice($.block, $.return_statement, $.external_name))),
      )),

    create_view: ($) =>
      prec.right(seq(
        $._create_or_alter,
        alias($._kw_view, 'VIEW'),
        field('name', $.object_name),
        optional($.parenthesized),
        optional(seq(alias($._kw_with, 'WITH'), $._header_items)),
        alias($._kw_as, 'AS'),
        field('body', alias($._body, $.body)),
      )),

    create_trigger: ($) =>
      prec.right(seq(
        $._create_or_alter,
        alias($._kw_trigger, 'TRIGGER'),
        field('name', $.object_name),
        alias($._kw_on, 'ON'),
        field('table', choice($._object_ref, alias($._kw_database, 'DATABASE'), seq(alias($._kw_all, 'ALL'), alias($._kw_server, 'SERVER')))),
        optional(seq(alias($._kw_with, 'WITH'), $._header_items)),
        choice(alias($._kw_for, 'FOR'), alias($._kw_after, 'AFTER'), seq(alias($._kw_instead, 'INSTEAD'), alias($._kw_of, 'OF'))),
        $._header_items,
        alias($._kw_as, 'AS'),
        optional(field('body', alias($._body, $.body))),
      )),

    create_table: ($) =>
      prec.right(
        2,
        seq(
          alias($._kw_create, 'CREATE'),
          alias($._kw_table, 'TABLE'),
          field('name', $._object_ref),
          optional($.parenthesized),
          optional(repeat1(choice($._item, alias($._kw_with, 'WITH'), alias($._kw_on, 'ON'), alias($._kw_as, 'AS')))),
        ),
      ),

  },
});
