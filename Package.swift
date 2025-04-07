// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterQ",
    products: [
        .library(name: "TreeSitterQ", targets: ["TreeSitterQ"]),
    ],
    dependencies: [
        .package(url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterQ",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                "src/scanner.c"
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterQTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterQ",
            ],
            path: "bindings/swift/TreeSitterQTests"
        )
    ],
    cLanguageStandard: .c11
)
