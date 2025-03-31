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
    $._subexpression
  ],

  conflicts: $ => [
  ],

  // alias immediate minus with the other operators
  externals: $ => [
    $.immediate_minus,
    $.newline_extra,
    $.regular_char
  ],

  rules: {

    program: $ => choice(
      $.shebang,
      prec(2,seq(
        optional(choice(
          seq($.shebang, token.immediate('\n')),
          alias($.comment_block_BOF, $.comment_block
          ))),
        optional(token(prec(2, /[ \t]+/))),
        repeat($._line),
        optional(choice(
          $.progn,
          $.system_command,
          alias($.comment_terminal,$.comment))) // due to EOF
      ))),

    _line: $ => choice(
      seq($.system_command, '\n'),
      seq(optional($.progn), '\n'),
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
          prec(1, /\n?[ \t]+/),
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
      )
    )),

    _subexpression: $ => prec.right(
      choice(
        $._nonterminal_exp,
        $._terminal_exp
      )),

    _nonterminal_exp: $ => choice(
      $._literal_definition, // the nice ones
      prec(1,$.variable),
      prec(1,$.sql_expression),
      $.func_app,
      $.parenthesis_exp
    ),

    _terminal_exp: $ => prec.right(
      choice(
        $.infix_mod_func,
        $.infix_projection,
        $.builtin_infix_func,
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

    func_app: $ => prec.right(
      choice(
        // expressions and builtins can use parameter pass
        seq(field("function", choice($._subexpression, $.builtin_infix_func, $.assignment_func)),
          field("parameters",$.parameter_pass)),
        // implicit currying or unary application
        seq(field("function", $._nonterminal_exp),
          field("parameter1", $._nonterminal_exp)),
        // implicit binary application with infix
        seq(field("parameter1",$._nonterminal_exp),
          field("function", $._infix_func),
          field("parameter2", $._nonterminal_exp)),
        // edge case with minus sign using external scanner
        seq(field("parameter1",$._nonterminal_exp),
          field("function", alias($.immediate_minus, $.builtin_infix_func)),
          field("parameter2", $._nonterminal_exp)),
        // we can assign any expression
        seq(field("parameter1",$._nonterminal_exp),
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
      seq(field("parameter", $._nonterminal_exp),
        field("function", choice($._infix_func, alias($.immediate_minus, $.builtin_infix_func)))),
    ),

    _infix_func: $ => prec(1,choice(
      $.builtin_infix_func,
      $.infix_mod_func,
      $.assignment_func,
    )),

    infix_mod_func: $ => seq(
      field("function", choice($._subexpression,$.builtin_infix_func)),
      field("modifier", alias(choice(
        token.immediate(prec(1,'\/')),
        token(choice(
          '\\', // Scan
          '\'', // each or case
          '\\:', // each left
          '\/:', // each right
          '\':', // each paralel or each prior
        ))
      ), $.infix_func_modifier))),

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

    identifier: $ => token.immediate(/[a-zA-Z0-9_]+/),

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
          alias(token.immediate(/[^\\"\r\n]+/), $.string_fragment),
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
      alias(token(/`[a-zA-Z0-9\._:]*/), $.regular_symbol),
      alias(token(/`:[a-zA-Z0-9\._:\\\/]*/), $.file_symbol)
    ),
    // no gaps for symbol list
    symbol_list: $ => seq(
      $.symbol,
      repeat1(alias($._slist_stub, $.symbol))
    ),
    _slist_stub: $ => choice(
      alias(token.immediate(prec(1,/`[a-zA-Z0-9\._:]*/)), $.regular_symbol),
      alias(token.immediate(prec(1,/`:[a-zA-Z0-9\._:\\\/]*/)), $.file_symbol)
    ),

    // catching invalid dates and invalid floats, must start with period or decimal
    // has lower precedence over symbols numbers and temporal
    invalid_atom: $ =>token(choice(
      /(\d|\.[0-9\.])[a-zA-Z0-9\.]*/,
      /\d[0-9D\:\.]*/ // strange temporal formats
    )),

    comment: $ => /\n?\/[^\n]*/,

    // multiline coments have to start with / then end with \
    // comment blocks have the flush with left side
    comment_block: $ => seq(
      token(prec(2,/\n[ \t]*\/[ \t]*\n/)),
      repeat(token.immediate(prec(2,choice( // always choose repeat over ending loop
        /[^\n\\][^\n]*\n/, // not \ immediately
        '\n' // straight up newline
      )))),
      token.immediate(choice(
        prec(1,/\\[ \t]*/), // ending comment block
        // EOF
        /[^\n\\][^\n]*/ // not / immediately
      ))),

    // comment block that starts at BOF
    comment_block_BOF: $ => seq(
      token(prec(3, /\/[ \t]*\n/)),
      repeat(token.immediate(prec(2,choice( // always choose repeat over ending loop
        /[^\n\\][^\n]*\n/, // not \ immediately
        '\n' // straight up newline
      )))),
      token.immediate(choice(
        prec(1,/\\[ \t]*/), // ending comment block
        // EOF
        /[^\n\\][^\n]*/ // not \ immediately
      ))),

    // comment block that end on EOF
    comment_terminal: $ => seq(
      token.immediate(/\\[ \t]*\n/), // this one is unescapable
      repeat(token.immediate(/[^\n]*\n/)), // tree-sitter a little weird with newlines
      token.immediate(/[^\n]*/) // the last line doesn't have a new line
    ),

    system_command: $ => choice(
      seq(
        alias(token.immediate(prec(-1, /\\(cd|ts|[abBcCdeEfglopPrsStTuvwWxz12_\\]|)/)),$.command),
        optional($._expression)),
      $.shell_command
    ),

    shell_command: $ => seq(
      token.immediate(prec(-1, /\\[^ \t\n]*/)),
      optional(token.immediate(/[^\n]+/)),
      repeat(token.immediate(/\n[ \t][^\n]*/))
    ),

    shebang: $ => seq(
      alias(token.immediate('#!'), $.bang),
      optional(token.immediate(/[ \t]+/)),
      field("command", alias(token.immediate(/.*/), $.interpreter)),
    )
  }
});
