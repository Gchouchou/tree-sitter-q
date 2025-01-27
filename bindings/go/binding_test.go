package tree_sitter_q_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_q "gitlab.com/gchouchou/tree-sitter-q.git/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_q.Language())
	if language == nil {
		t.Errorf("Error loading Q grammar")
	}
}
