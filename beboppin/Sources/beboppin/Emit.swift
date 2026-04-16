import Foundation

struct NDJSONFrame: Encodable {
    let timestamp: Double
    let app_name: String
    let reason: String
    let display_id: UInt32
    let scale_factor: Double
    let monitor: Monitor
    let screenshot_path: String
    let ocr_text: String
    let ocr_boxes: [OCRBoxEncodable]

    struct Monitor: Encodable {
        let width: Int
        let height: Int
        let left: Int
        let top: Int
    }

    struct OCRBoxEncodable: Encodable {
        let text: String
        let x: Double
        let y: Double
        let w: Double
        let h: Double
    }
}

enum Emit {
    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    static func encodeLine(_ frame: NDJSONFrame) throws -> String {
        let data = try encoder.encode(frame)
        guard let s = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "beboppin", code: 1, userInfo: [NSLocalizedDescriptionKey: "UTF-8 encode failed"])
        }
        return s
    }

    static func writeLine(_ line: String, fileHandle: FileHandle) {
        if let data = (line + "\n").data(using: .utf8) {
            fileHandle.write(data)
        }
    }

    static func writeLineStdout(_ line: String) {
        if let data = (line + "\n").data(using: .utf8) {
            FileHandle.standardOutput.write(data)
        }
    }
}
