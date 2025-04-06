; highlights.scm

[
 "by"
 "delete"
 "exec"
 "from"
 "select"
 "update"
 "where"
] @keyword

(string) @string
(escape_sequence) @string.special
(comment) @comment
(number) @number
(regular_symbol) @constant
(file_symbol) @string.special
(return) @return

(namespace) @variable
((namespace) @module.builtin (#match? @module.builtin "^\..$"))

(identifier) @variable
(variable) @variable

(assignment_func) @punctuation
(semicolon) @punctuation
(table_definition) @punctuation.bracket
(list_definition) @punctuation.bracket
(func_definition) @punctuation.bracket
(table_columns) @punctuation.delimter
(parameter_pass) @punctuation.bracket

(func_definition
 parameters: (parameter_pass
  (variable) @variable.parameter))

(func_definition
 parameters: (parameter_pass
  (variable) @variable.parameter.builtin (#any-of? @variable.parameter.builtin "x" "y" "z" )))

(func_app function: (_) @function)

(func_app
  function: ((variable (identifier) @function.builtin))
    (#any-of? @function.builtin
      "abs" "acos" "aj" "aj0" "all" "and" "any" "asc" "asin" "asof" "atan" "attr"
      "avg" "avgs" "bin" "binr" "by" "ceiling" "cols" "cor" "cos" "count" "cov"
      "cross" "cut" "delete" "deltas" "desc" "dev" "differ" "distinct" "div" "do"
      "dsave" "each" "ej" "enlist" "eval" "except" "exec" "exit" "exp" "fby"
      "fills" "first" "fkeys" "flip" "floor" "from" "get" "getenv" "group" "gtime"
      "hclose" "hcount" "hdel" "hopen" "hsym" "iasc" "idesc" "if" "ij" "in"
      "insert" "inter" "inv" "key" "keys" "last" "like" "lj" "ljf" "load" "log"
      "lower" "lsq" "ltime" "ltrim" "mavg" "max" "maxs" "mcount" "md5" "mdev"
      "med" "meta" "min" "mins" "mmax" "mmin" "mmu" "mod" "msum" "neg" "next"
      "not" "null" "or" "over" "parse" "peach" "pj" "prd" "prds" "prev" "prior"
      "rand" "rank" "ratios" "raze" "read0" "read1" "reciprocal" "reval" "reval"
      "reverse" "rload" "rotate" "rsave" "rtrim" "save" "scan" "scov" "sdev"
      "select" "set" "setenv" "show" "signum" "sin" "sqrt" "ss" "ssr" "string"
      "sublist" "sum" "sums" "sv" "svar" "svar" "system" "tables" "tan" "til"
      "trim" "type" "uj" "ungroup" "union" "update" "upper" "upsert" "value"
      "var" "view" "views" "vs" "wavg" "where" "while" "within" "wj" "wj1"
      "wsum" "ww" "xasc" "xbar" "xcol" "xcols" "xdesc" "xexp" "xgroup" "xkey"
      "xlog" "xprev" "xrank"))



(builtin_infix_func) @operator

(system_command
 command: (_) @function)

(glob) @string
