import Foundation

enum Clock {
    /// Wall-clock seconds since Unix epoch with microsecond precision (best effort).
    static func nowUnixSeconds() -> Double {
        Date().timeIntervalSince1970
    }

    /// Filename-safe timestamp string for JPEG paths.
    static func fileTimestamp(from unix: Double) -> String {
        String(format: "%.6f", unix)
    }

    /// Sleep until the next tick boundary (approximately `interval` between loop iterations).
    static func sleep(interval: TimeInterval) async {
        let nanos = UInt64(max(0, interval) * 1_000_000_000)
        try? await Task.sleep(nanoseconds: nanos)
    }
}
