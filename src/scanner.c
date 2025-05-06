#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"

// We only have a single element right now, but keep in mind that the order
// must match the `externals` array in `grammar.js`.
typedef enum { NEW_LINE_EXTRA, ONE_CHAR } TokenType;

// If we need to allocate/deallocate state, we do it in these functions.
void * tree_sitter_q_external_scanner_create() {return NULL;}
void tree_sitter_q_external_scanner_destroy(void *payload) {}

// If we have state, we should load and save it in these functions.
unsigned tree_sitter_q_external_scanner_serialize(void *payload,
                                                  char *buffer) {
    return 0;
}

void tree_sitter_q_external_scanner_deserialize(void *payload, char *buffer,
                                                unsigned length) {}

bool tree_sitter_q_external_scanner_scan(void *payload, TSLexer *lexer,
                                         const bool *valid_symbols) {
    // match newline with lookahead
    if (valid_symbols[NEW_LINE_EXTRA] &&
        (lexer->lookahead == '\t' || lexer->lookahead == ' ' ||
         lexer->lookahead == '\r' || lexer->lookahead == '\n'))
    {

      // skip whitespace
      while (lexer->lookahead == '\t' || lexer->lookahead == ' ') lexer->advance(lexer, true);

      // windows new line return
      if (lexer->lookahead == '\r')  lexer->advance(lexer, false);
      if (lexer->lookahead == '\n') {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        // new line into new line
        if (lexer->lookahead == '\n' || lexer->lookahead == '\t' ||
            lexer->lookahead == ' ' || lexer->lookahead == '\r') {
          lexer->result_symbol = NEW_LINE_EXTRA;
          return true;
        }
      }
      // it is a regular new line and we should not match anything
      return false;
    }

    // matches immediately a non escaped char with lookahead
    if (valid_symbols[ONE_CHAR] && lexer->lookahead != '\n' &&
        lexer->lookahead != '\r' && lexer->lookahead != '\\' &&
        lexer->lookahead != '"' && !lexer->eof(lexer)) {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        // check if it is exactly one character
        if (lexer->lookahead == '"') {
            lexer->result_symbol = ONE_CHAR;
            return true;
        } else {
            return false;
        }
    }
    return false;
}
