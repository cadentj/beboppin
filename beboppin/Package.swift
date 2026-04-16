// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "beboppin",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "beboppin", targets: ["beboppin"]),
    ],
    targets: [
        .executableTarget(
            name: "beboppin",
            dependencies: [],
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
    ]
)
