import CoreGraphics
import Foundation
import Vision

struct OCRBox {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

enum OCR {
    /// Recognize text at `.fast` quality; returns boxes in pixel coordinates with top-left origin (y increases downward).
    static func recognizeText(in image: CGImage) async throws -> [OCRBox] {
        try await withCheckedThrowingContinuation { cont in
            let request = VNRecognizeTextRequest { req, error in
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                guard let observations = req.results as? [VNRecognizedTextObservation] else {
                    cont.resume(returning: [])
                    return
                }
                let w = Double(image.width)
                let h = Double(image.height)
                var boxes: [OCRBox] = []
                for obs in observations {
                    guard let cand = obs.topCandidates(1).first else { continue }
                    let t = cand.string.trimmingCharacters(in: .whitespacesAndNewlines)
                    if t.isEmpty { continue }
                    let rect = obs.boundingBox
                    let bw = rect.size.width * w
                    let bh = rect.size.height * h
                    let x = rect.origin.x * w
                    let yTop = (1.0 - rect.origin.y - rect.size.height) * h
                    boxes.append(OCRBox(text: t, x: x, y: yTop, w: bw, h: bh))
                }
                cont.resume(returning: boxes)
            }
            request.recognitionLevel = .fast
            request.usesLanguageCorrection = false
            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                cont.resume(throwing: error)
            }
        }
    }

    static func mergedText(from boxes: [OCRBox]) -> String {
        boxes.map(\.text).joined(separator: "\n")
    }
}
