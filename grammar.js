/**
 * @file A treesitter parser for q
 * @author Justin Yu
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "q",

  word: $ => $._init_identifier,

  extras: $ => [
    prec(1, /[ \t]+/), // new line and space to skip
    $.newline_extra,
    $.comment,
    $.comment_block
  ],

  inline: $ => [
    $._literal_definition,
    $._seperator,
    $._column_list_definition,
    $._infix_func,
    $._atomic_exp,
    $._comment_block_body,
    $._subexpression,
    $._variable_repeat,
    $._nlist_sub
  ],

  conflicts: $ => [
    [$.bracket_progn, $.parameter_pass]
  ],

  // alias immediate minus with the other operators
  externals: $ => [
    $.newline_extra,
    $.regular_char
  ],

  precendence: $ => [

  ],

  rules: {

    program: $ => choice(
      $.shebang,
      prec(2,seq(
        optional(choice(
          seq($.shebang, token.immediate(/\r?\n/)),
          alias($.comment_block_BOF, $.comment_block
          ))),
        repeat($._line),
        optional(choice(
          $.progn,
          $.system_command,
          alias(token(/[kp]\)[^\r\n]*/), $.dsl),
          alias($.comment_terminal,$.comment))) // due to EOF
      ))),

    _line: $ => choice(
      seq($.system_command, /\r?\n/),
      seq($.progn, /\r?\n/),
      seq(alias(token(/[kp]\)[^\r\n]*/), $.dsl), token.immediate(/\r?\n/)),
      /\r?\n/
    ),

    // a line in q is an implicit progn, returning the last expression
    progn: $ => prec.right(seq(
      repeat(seq(optional($._expression),$._seperator)),
      choice(field("output", $._expression), seq(optional($._expression),$._seperator))
    )),

    // semicolon catches whitespaces
    _seperator: $ => prec.right(seq(
      alias(';', $.semicolon),
      repeat(
        choice(
          $.newline_extra,
          $.comment,
          $.comment_block
        )
      )
    )),

    _expression: $ => prec(
      -1,
      choice(
        alias($._prefix_expression, $.func_app),
        $.bracket_progn,
        // regular
        $._subexpression
      ),
    ),

    _prefix_expression: $ => prec.right(choice(
      seq(
        field("function", choice( alias(':', $.return), alias('\'', $.signal) )),
        field("parameter1", $._subexpression)
      ),
      seq(
        field("function", alias('\'', $.composition)),
        field("parameters",$.parameter_pass)
      ),
      $._func_app_prefix
    )),

    bracket_progn: $ => prec(-1, seq(
      '[',
      repeat(seq(optional($._expression),$._seperator)),
      optional(field("output", $._expression)),
      ']'
    )),

    _func_app_prefix: $ => prec(-1, choice(
      // implicit currying or unary application
      seq(field("function", $.bracket_progn),
        field("parameter1", $._nonterminal_exp)),
      // implicit binary application with infix
      seq(field("parameter1",$.bracket_progn),
        field("function", choice($._infix_func, alias($.immediate_minus, $.builtin_infix_func))),
        field("parameter2", $._nonterminal_exp)),
      // we can assign any expression
      seq(field("parameter1",$.bracket_progn),
        field("function", alias(':', $.assignment_func)),
        field("parameter2", $._subexpression))
    )),

    _subexpression: $ => prec.right(
      choice(
        $._nonterminal_exp,
        $._terminal_exp
      )),

    _nonterminal_exp: $ => prec.right(
      choice(
      $._atomic_exp,
      $.sql_expression,
      $.func_app
    )),

    _atomic_exp: $ => choice(
      alias($.func_app_with_param, $.func_app),
      $._literal_definition,
      $.variable,
      $.parenthesis_exp
    ),

    _terminal_exp: $ => prec.right(
      choice(
        $.infix_mod_func,
        $.infix_projection,
        $.builtin_infix_func,
        $.implicit_composition,
        $.assignment_func
      )),

    // literal definitions
    _literal_definition: $ => choice(
      $.number,
      $.byte_list,
      $.temporal,
      $.char,
      $.string,
      $.symbol,
      $.symbol_list,
      $.number_list,
      $.temporal_list,
      $.invalid_atom,
      $.func_definition,
      $.table_definition,
      $.list_definition
    ),

    table_definition: $ => seq(
      '(',
      // keyed columns
      choice(
        seq('[', ']'),
        field("keyed_columns",$.table_keys)
      ),
      // non keyed columns
      optional($._seperator),optional($._column_list_definition),
      ')'
    ),

    table_keys: $ => seq('[', $._column_list_definition,']'),

    _column_list_definition: $ => seq(
      $._expression,
      repeat(seq($._seperator, $._expression)),
    ),

    func_definition: $ => seq(
      '{',
      optional(field("parameters", $.parameter_pass)),
      optional(field("body",alias($.progn, $.func_body))),
      '}'
    ),

    list_definition: $ => seq(
      '(',
      optional(
        seq(
          optional($._expression),
          repeat1(seq($._seperator,optional($._expression))))),
      ')'
    ),

    func_app_with_param: $ => prec.right(
      // expressions and builtins can use parameter pass
      seq(field("function", choice($._atomic_exp, $.builtin_infix_func, $.assignment_func, $.infix_mod_func)),
        field("parameters",$.parameter_pass)),
    ),

    func_app: $ => prec.right(
      choice(
        // implicit currying or unary application
        seq(field("function", $._atomic_exp),
          field("parameter1", $._nonterminal_exp)),
        // implicit binary application with infix
        seq(field("parameter1",$._atomic_exp),
          field("function", choice($._infix_func, alias($.immediate_minus, $.builtin_infix_func))),
          field("parameter2", $._nonterminal_exp)),
        // we can assign any expression
        seq(field("parameter1",$._atomic_exp),
          field("function", alias(':', $.assignment_func)),
          field("parameter2", $._subexpression))
      )),

    parameter_pass: $ => seq(
      '[',
      optional($._expression),
      // we alias semicolon since projections could be important
      repeat(
        seq($._seperator,optional($._expression))
      ),
      ']'
    ),

    infix_projection: $ => prec.right(
      seq(field("parameter1", $._atomic_exp),
        field("function", choice($._infix_func, alias($.immediate_minus, $.builtin_infix_func)))),
    ),

    implicit_composition: $ => prec.right(
      seq(
        choice(
          field("function1", $._atomic_exp),
          // infix projection does not work because it also matches with func app node
          // This is a workaround but the syntax tree will be slightly different
          prec.right(
            seq(field("parameter1", $._atomic_exp),
              field("function1", choice($._infix_func, alias($.immediate_minus, $.builtin_infix_func)))),
          )
        ),
        field("function2", $._terminal_exp)
      )
    ),

    _infix_func: $ => prec(1,choice(
      $.builtin_infix_func,
      $.infix_mod_func,
      $.assignment_func
    )),

    infix_mod_func: $ => seq(
      field("function", choice($._atomic_exp, $._infix_func)),
      field("modifier", alias(choice(
        token.immediate(prec(1,'\/')),
        token(choice(
          '\\', // Scan
          '\'', // each or case
          '\\:', // each left
          '\/:', // each right
          '\':' // each paralel or each prior
        ))
      ), $.infix_func_modifier))),

    immediate_minus: $ => token.immediate(prec(1, '-')),

    //  regular infix funcs except comma
    builtin_infix_func: $ => choice(
      '-',
      token(choice('+',  '*', '%', // simple arithmetic without minus cuz it's special
        '>', '<', '=', '<>', '>=', '<=','~', // comparison operators
        '_', '#', '$', '!',
        '.', // apply
        '@', // trap
        'mmu', 'lsq', // matrix
        '?', 'bin', 'binr', 'in', 'within', // search
        'or','and','|', '&', // logic operators
        'each', 'peach',
        'setenv',
        'div', 'mod', // interger
        'wavg', 'wsum', // weighted
        'cor', 'cov', 'scov', // stats
        'cross',
        'union', 'inter', 'except', 'sublist', // set operations
        'vs', 'sv', // string to list or viceversa
        'ss', 'like', // substring searching
        'mmax', 'mmin', 'mavg', 'msum', 'mdev', 'mcount', 'ema', // moving stuff
        'ij', 'ijf', 'uj', 'ujf', 'lj', 'ljf', 'asof', 'pj', '^', // table joins
        'insert', 'upsert',
        'xasc', 'xdesc', 'xcol', 'xcols', 'xkey', // table stuff
        'xprev', 'xrank',
        'xbar','xexp', 'xlog', // math functions
        '0:', '1:', '2:', // file streaming
        ',',
        'dsave'))
    ),

    // :: is also the empty expression, be careful of that
    assignment_func: $ => prec.right(choice(
      ':', // care for this symbol
      token(choice(
        '::',
        // regular assignment
        '+:', '-:', '*:', '%:', // math
        '>:', '<:', '~:', '=:', // comparison
        '_:', '#:', '$:', '!:', // list manip
        '|:', "$:", // logic
        '?:', // search?
        '^:', // fill assign?
        ',:')))),

    sql_expression: $ => prec.right(seq(
      choice(
        seq(
          'select',
          optional($.limit_expression),
          optional('distinct'),
          optional(field("columns", $.table_columns)),
          optional(seq('by', field("keys" ,$.table_columns)))
        ),
        seq(
          'exec',
          optional('distinct'),
          optional(field("columns", $.table_columns)),
          optional(seq('by', field("keys" ,$.table_columns)))
        ),
        seq(
          'update',
          optional(field("columns", $.table_columns)),
          optional(seq('by', field("keys" ,$.table_columns)))
        ),
        seq(
          'delete',
          optional(field("columns", $.table_columns)),
        ),
      ),
      'from',
      field("table", $._expression),
      optional(
        seq(
          'where',
          field("conditions",alias($.table_columns, $.table_conditions))
        )))),

    limit_expression: $ => seq(
      '[',
      choice(
        field("limit",$._subexpression),
        seq(
          optional(seq(field("limit", $._subexpression), $._seperator)),
          $.order_expression)
      ),
      ']'
    ),

    order_expression: $ => seq(
      field("order", token(prec(10, choice('>', '<')))),
      field("column", $._subexpression)
    ),

    table_columns: $ => prec.right(seq($._subexpression, repeat(prec(7,$._table_expression_wrapper)))),

    _table_expression_wrapper: $ => prec.right(
      seq(token(prec(100,',')),$._subexpression)
    ),

    parenthesis_exp: $ => seq(
      seq('(', $._expression, ')')
    ),

    // all the regex is after this
    // a variable or function, basically an identifier
    variable: $ => prec.right(choice(
      // naked identifier
      field("element", choice($.namespace, alias($._init_identifier, $.identifier))),
      seq(
        choice($.namespace,alias($._init_identifier, $.identifier)),
        $._variable_period,
        optional($._variable_repeat),
        optional(field("element", $.identifier))
      )
    )),

    _init_identifier: $ => token(/[a-zA-Z][a-zA-Z0-9_]*/),
    namespace: $ => token(/\.[a-zA-Z][a-zA-Z0-9_]*/),

    identifier: $ => token.immediate(prec(1, /[a-zA-Z0-9_]+/)),

    _variable_repeat: $ => prec.right(1,
      repeat1(seq($.identifier, $._variable_period)),
    ),

    _variable_period: $ => token.immediate(prec(1,'.')),

    // any regular number
    number: $ => token(choice(
      // all digits without point are long
      alias(token(choice(
        /-?\d+j?/, /0[NW]j?/
      )), $.long),
      alias(token(
        /[01]b/
      ), $.boolean),
      alias(token(
        /0x[0-9a-fA-F]/
      ), $.byte),
      alias(token(
        '0Ng'
      ), $.guid),
      alias(token(choice(
        /-?\d+h/, /0[NW]h/
      )), $.short),
      alias(token(choice(
        /-?\d+i/, /0[NW]i/
      )), $.int),
      alias(token(choice(
        /-?\d+\.?\d*(e-?\d+)?f?/,
        /0[nw]/,
        '0Nf'
      )), $.float),
      alias(token(choice(
        /-?\d+\.?\d*(e-?\d+)?e/,
        /0[NW]e/
      )), $.real),
    )),

    number_list: $ => prec(10,seq(
      $.number,
      $._nlist_sub
    )),

    byte_list: $ => token(prec(1,/0x[0-9a-fA-F][0-9a-fA-F]+/)),

    _nlist_sub: $ => prec.right(repeat1(prec(19,$.number))),

    temporal: $ => token(choice(
      // year.monthm, month type
      alias(token(
        choice(/\d{4}\.(0\d|1[012])m/, '0Nm')
      ), $.month),
      // year.month.date, date type
      alias(token(
        choice(/\d{4}\.(0\d|1[012])\.([0-2]\d|3[01])/, /0[NW]d/)
      ), $.date),
      alias(token(choice(
        // year.month.dateD, timestamp type
        /[12]\d{3}\.(0\d|1[012])\.([0-2]\d|3[01])D/,
        // year.month.dateDhour, timestamp type
        /[12]\d{3}\.(0\d|1[012])\.([0-2]\d|3[01])D([01]\d|2[0124]):?/,
        // year.month.dateDhour:minute,
        /[12]\d{3}\.(0\d|1[012])\.([0-2]\d|3[01])D([01]\d|2[0124]):[0-5]\d:?/,
        // year.month.dateDhour:minute:second.miliseconds,
        /[12]\d{3}\.(0\d|1[012])\.([0-2]\d|3[01])D([01]\d|2[0124]):[0-5]\d:[0-5]\d(\.\d*)?/,
        // special
        /0[NW]p/,
      )), $.timestamp),
      alias(token(choice(
        //hours: minute type
        /-?\d{2}:/,
        //hours:minutes:
        /-?\d{2}:[0-5]\d:?/,
        /0[NW]u/
      )), $.minute),
      //hours:minutes:seconds second type
      alias(token(choice(
        /-?\d{2}:[0-5]\d:[0-5]\d\.?/, /0[NW]v/
      )), $.second),
      //hours:minutes:seconds.miliseconds time type
      alias(token(choice(
        /-?\d{2}:[0-5]\d:[0-5]\d\.\d+/,
        /0[NW]t/
      )), $.time),
      alias(token(choice(
        // daysD
        /-?\d+D/,
        // daysDhours:
        /-?\d+D\d{2}:?/,
        // daysDhours:minutes:
        /-?\d+D\d{2}:[0-5]\d:?/,
        // daysDhours:minutes:seconds.miliseconds
        /-?\d+D\d{2}:[0-5]\d:[0-5]\d(\.\d*)?/,
        /0[NW]n/
      )), $.timespan),
      alias(token(choice('0Nz', '0wz')), $.datetime)
    )),

    temporal_list: $ => prec(10,seq(
      $.temporal,
      $._dtlist_sub
    )),

    _dtlist_sub: $ => prec.right(
      repeat1(prec(19,$.temporal))
    ),

    // char has exactly one character
    char: $ => prec(1, seq(
      '"',
      choice(
        $.regular_char,
        $.escape_sequence
      ),
      '"'
    )),

    // string has at least 2 characters or none at all
    string: $ => choice(
      token('""'),
      seq(
        '"',
        repeat1(choice(
          alias(token.immediate(prec(1, /[^\\"\r\n]+/)), $.string_fragment),
          $.escape_sequence
        )),
        '"'
      )
    ),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      choice(
        /[\\"nrt]/, // classic stuff
        /\d{3}/ // ASCII escape
      ),
    )),

    // just some letters, numbers, underscores, colons and slashes
    symbol: $ => choice(
      alias(token(/`:[a-zA-Z0-9\._:\\\/]*/), $.file_symbol),
      alias(token(/`[a-zA-Z0-9\._:]*/), $.regular_symbol)
    ),
    // no gaps for symbol list
    symbol_list: $ => seq(
      $.symbol,
      repeat1(alias($._slist_sub, $.symbol))
    ),

    _slist_sub: $ => choice(
      alias(token.immediate(prec(1,/`:[a-zA-Z0-9\._:\\\/]*/)), $.file_symbol),
      alias(token.immediate(prec(1,/`[a-zA-Z0-9\._:]*/)), $.regular_symbol)
    ),

    // catching invalid dates and invalid floats, must start with period or decimal
    // has lower precedence over symbols numbers and temporal
    invalid_atom: $ =>token(choice(
      /(\d|\.[0-9\.])[a-zA-Z0-9\.]*/,
      /\d[0-9D\:\.]*/ // strange temporal formats
    )),

    comment: $ => /(\r?\n)?\/[^\n]*/,

    // multiline coments have to start with / then end with \
    // comment blocks have the flush with left side
    comment_block: $ => seq(
      token(prec(2,/\r?\n\/[ \t]*\r?\n/)),
      $._comment_block_body
    ),

    // comment block that starts at BOF
    comment_block_BOF: $ => seq(
      token.immediate(prec(3, /\/[ \t]*\r?\n/)),
      $._comment_block_body
    ),

    _comment_block_body: $ => seq(
      repeat(token.immediate(prec(2,choice( // always choose repeat over ending loop
        /[^\n\\][^\n]*\r?\n/, // not \ immediately
        /\r?\n/ // straight up newline
      )))),
      token.immediate(choice(
        prec(1,/\\[ \t]*/), // ending comment block
        // EOF
        /[^\n\\][^\n]*/ // not \ immediately
      ))
    ),

    // comment block that end on EOF
    comment_terminal: $ => seq(
      token.immediate(/\\[ \t]*\r?\n/),
      repeat(token.immediate(/[^\n]*\r?\n/)), // tree-sitter a little weird with newlines
      token.immediate(/[^\n]*/) // the last line doesn't have a new line
    ),

    // only accepts integer, used for system commands
    _integer: $ => token(/[0-9]+i?/),

    // some non white space thing, used for system commands
    glob: $ => token(prec(1, /[^ \t\n]+/)),

    system_command: $ => choice(
      // group commands by syntax group
      // naked sys command that should not accept anything
      field("command", alias(token.immediate(prec(-1, /\\[Eru]/)), $.command)),
      // optional subexpression
      seq(
        field("command", alias(token.immediate(prec(-1, /\\[abBdfv]/)), $.command)),
        optional($._subexpression)
      ),
      // mandatory subexpression
      seq(
        field("command", alias(token.immediate(prec(-1, '\\x')), $.command)),
        $._subexpression
      ),
      // optional number list
      seq(
        field("command", alias(token.immediate(prec(-1, /\\[cC]/)), $.command)),
        optional($.number_list)
      ),
      // optional glob
      seq(
        field("command", alias(token.immediate(prec(-1, /\\(cd|_)/)), $.command)),
        optional($.glob)
      ),
      // mandatory glob
      seq(
        field("command", alias(token.immediate(prec(-1, /\\[pl12]/)), $.command)),
        $.glob
      ),
      // optional integers
      seq(
        field("command", alias(token.immediate(prec(-1, /\\[egoPsSTwWz]/)), $.command)),
        optional(field("command", $._integer, $.number))
      ),
      // 2 mandatory filepath for rename
      seq(
        field("command", alias(token.immediate(prec(-1, '\\r')), $.command)),
        $.glob,
        $.glob
      ),
      // timer
      seq(
        field("command", alias(token.immediate(prec(-1, '\\t')), $.command)),
        optional(
          choice(
            alias($._integer, $.number), // set timer interval
            seq(
              optional(
                seq(token.immediate(':'),
                  alias(token.immediate(/[0-9]+i?/), $.number)
                )
              ),
              $._subexpression)))),
      // time and space
      seq(
        field("command", alias(token.immediate(prec(-1, '\\ts')), $.command)),
        seq(
          optional(
            seq(token.immediate(':'),
              alias(token.immediate(/[0-9]+i?/), $.number)
            )
          ),
          $._subexpression
        )
      ),
      // ignore everything after command
      seq(
        field("command", alias(token.immediate(prec(-1, /\\\\?/)), $.command)),
        optional(token.immediate(prec(1, /[^\n]+/)))
      ),

      field("command", $.shell_command)
    ),

    shell_command: $ => seq(
      choice(
        token.immediate(prec(-1, /\\[a-zA-Z]+/)),
        token.immediate(prec(-2, /\\[^ \t\n]+/)),
      ),
      optional(token.immediate(/[^\r\n]+/)),
      repeat(token.immediate(/\r?\n[ \t][^\r\n]*/))
    ),

    shebang: $ => seq(
      token.immediate('#!'),
      optional(token.immediate(/[ \t]+/)),
      alias(token.immediate(/.*/), $.program),
    )
  }
});
