import XCTest
import SwiftTreeSitter
import TreeSitterQ

final class TreeSitterQTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_q())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Q grammar")
    }
}
