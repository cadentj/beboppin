import CoreGraphics
import CoreImage
import CoreMedia
import CoreVideo
import Foundation
import ScreenCaptureKit
import UniformTypeIdentifiers

enum DisplayCapture {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Primary: ScreenCaptureKit one frame. Fallback: `CGDisplayCreateImage` (main display).
    static func captureMainDisplay() async throws -> CGImage? {
        do {
            if let img = try await captureOneFrameViaStream() {
                return img
            }
        } catch {
            // Fall back to CGDisplayCreateImage when ScreenCaptureKit fails (e.g. permission / config).
        }
        return CGDisplayCreateImage(CGMainDisplayID())
    }

    /// Downscale wide frames before JPEG to keep hourly storage reasonable.
    static func resizedForJPEG(_ image: CGImage, maxWidth: CGFloat = 1920) -> CGImage {
        let w = CGFloat(image.width)
        let h = CGFloat(image.height)
        if w <= maxWidth { return image }
        let scale = maxWidth / w
        let newW = maxWidth
        let newH = max(1, (h * scale).rounded(.toNearestOrAwayFromZero))
        guard let ctx = CGContext(
            data: nil,
            width: Int(newW),
            height: Int(newH),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return image }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: newW, height: newH))
        return ctx.makeImage() ?? image
    }

    static func jpegData(from image: CGImage, quality: CGFloat = 0.82) -> Data? {
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(
            data as CFMutableData,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { return nil }
        let options: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: quality]
        CGImageDestinationAddImage(dest, image, options as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return data as Data
    }

    // MARK: - ScreenCaptureKit

    private static func captureOneFrameViaStream() async throws -> CGImage? {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let mainID = CGMainDisplayID()
        guard let display = content.displays.first(where: { $0.displayID == mainID }) ?? content.displays.first else {
            return nil
        }
        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.width = Int(display.width)
        config.height = Int(display.height)
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true
        config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        config.queueDepth = 4

        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<CGImage?, Error>) in
            let output = StreamOutput(continuation: cont)
            do {
                let stream = SCStream(filter: filter, configuration: config, delegate: output)
                output.streamRef = stream
                let queue = DispatchQueue(label: "beboppin.scstream", qos: .userInitiated)
                try stream.addStreamOutput(output, type: .screen, sampleHandlerQueue: queue)
                stream.startCapture()
            } catch {
                cont.resume(throwing: error)
            }
        }
    }

    private final class StreamOutput: NSObject, SCStreamDelegate, SCStreamOutput {
        private var continuation: CheckedContinuation<CGImage?, Error>?
        private let lock = NSLock()
        weak var streamRef: SCStream?

        init(continuation: CheckedContinuation<CGImage?, Error>) {
            self.continuation = continuation
        }

        private func finish(_ result: Result<CGImage?, Error>) {
            lock.lock()
            defer { lock.unlock() }
            guard let cont = continuation else { return }
            continuation = nil
            switch result {
            case .success(let img):
                cont.resume(returning: img)
            case .failure(let err):
                cont.resume(throwing: err)
            }
        }

        func stream(_ stream: SCStream, didStopWithError error: Error) {
            finish(.failure(error))
        }

        func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
            guard outputType == .screen else { return }
            guard let image = Self.image(from: sampleBuffer) else { return }
            stream.stopCapture()
            finish(.success(image))
        }

        private static func image(from sampleBuffer: CMSampleBuffer) -> CGImage? {
            guard let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return nil }
            CVPixelBufferLockBaseAddress(buffer, .readOnly)
            defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
            let ciImage = CIImage(cvPixelBuffer: buffer)
            return ciContext.createCGImage(ciImage, from: ciImage.extent.integral)
        }
    }
}
