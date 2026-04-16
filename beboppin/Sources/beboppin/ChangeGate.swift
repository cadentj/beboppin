import CoreGraphics
import Foundation

/// DCT-based 64-bit perceptual hash (32×32 grayscale → 8×8 low-frequency, median threshold).
enum ChangeGate {
    static let hammingThreshold: Int = 5

    enum Decision: Equatable {
        case skip
        case keep(reason: String, phash: UInt64)
    }

    static func evaluate(
        previousApp: String,
        previousDisplay: UInt32,
        previousPhash: UInt64?,
        appName: String,
        displayID: UInt32,
        image: CGImage
    ) -> Decision {
        if appName != previousApp {
            let ph = perceptualHash(of: image)
            return .keep(reason: "app_switch", phash: ph)
        }
        if displayID != previousDisplay {
            let ph = perceptualHash(of: image)
            return .keep(reason: "display_change", phash: ph)
        }
        let ph = perceptualHash(of: image)
        if let prev = previousPhash {
            let dist = hammingDistance(ph, prev)
            if dist < hammingThreshold {
                return .skip
            }
            return .keep(reason: "pixel_diff", phash: ph)
        }
        return .keep(reason: "pixel_diff", phash: ph)
    }

    static func hammingDistance(_ a: UInt64, _ b: UInt64) -> Int {
        (a ^ b).nonzeroBitCount
    }

    /// Public entry for storing the first frame's hash after capture.
    static func phash(of image: CGImage) -> UInt64 {
        perceptualHash(of: image)
    }

    private static func perceptualHash(of image: CGImage) -> UInt64 {
        guard let gray32 = grayscale32x32(from: image) else { return 0 }
        let dct = dct2D32x32(gray32)
        // Standard pHash: 8×8 low-frequency block from DCT, skipping DC — use indices (1...8, 1...8).
        var coeffs: [Double] = []
        coeffs.reserveCapacity(64)
        for y in 1...8 {
            for x in 1...8 {
                coeffs.append(dct[y * 32 + x])
            }
        }
        let median = coeffs.sorted()[coeffs.count / 2]
        var bits: UInt64 = 0
        for i in 0..<64 {
            if coeffs[i] > median {
                bits |= (1 as UInt64) << UInt64(i)
            }
        }
        return bits
    }

    // MARK: - 32×32 grayscale

    fileprivate static func grayscale32x32(from image: CGImage) -> [Double]? {
        let w = 32
        let h = 32
        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(
            data: &pixels,
            width: w,
            height: h,
            bitsPerComponent: 8,
            bytesPerRow: w * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        var gray = [Double](repeating: 0, count: w * h)
        for i in 0..<(w * h) {
            let o = i * 4
            let r = Double(pixels[o])
            let g = Double(pixels[o + 1])
            let b = Double(pixels[o + 2])
            gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        }
        return gray
    }

    // MARK: - Separable 2D DCT-II on 32×32

    private static func dct2D32x32(_ input: [Double]) -> [Double] {
        precondition(input.count == 32 * 32)
        var rowDct = [Double](repeating: 0, count: 32 * 32)
        for y in 0..<32 {
            let row = (0..<32).map { input[y * 32 + $0] }
            let d = dct1D(row)
            for x in 0..<32 {
                rowDct[y * 32 + x] = d[x]
            }
        }
        var out = [Double](repeating: 0, count: 32 * 32)
        for x in 0..<32 {
            let col = (0..<32).map { rowDct[$0 * 32 + x] }
            let d = dct1D(col)
            for y in 0..<32 {
                out[y * 32 + x] = d[y]
            }
        }
        return out
    }

    private static func dct1D(_ x: [Double]) -> [Double] {
        let N = x.count
        var y = [Double](repeating: 0, count: N)
        let factor = Double.pi / Double(N)
        for k in 0..<N {
            var sum = 0.0
            for n in 0..<N {
                sum += x[n] * cos(factor * (Double(n) + 0.5) * Double(k))
            }
            let scale = k == 0 ? sqrt(1.0 / Double(N)) : sqrt(2.0 / Double(N))
            y[k] = sum * scale
        }
        return y
    }
}
