import AppKit
import CoreGraphics
import Darwin
import Foundation

@main
enum Beboppin {
    private static let stopFlag = StopFlag()

    private final class StopFlag: @unchecked Sendable {
        private let lock = NSLock()
        private var stopped = false

        func set() {
            lock.lock()
            stopped = true
            lock.unlock()
        }

        func get() -> Bool {
            lock.lock()
            defer { lock.unlock() }
            return stopped
        }
    }

    static func main() async {
        await run()
    }

    private static func installSignalHandlers() {
        signal(SIGINT, SIG_IGN)
        signal(SIGTERM, SIG_IGN)
        let q = DispatchQueue(label: "beboppin.signals")
        let intSrc = DispatchSource.makeSignalSource(signal: SIGINT, queue: q)
        intSrc.setEventHandler { stopFlag.set() }
        intSrc.resume()
        let termSrc = DispatchSource.makeSignalSource(signal: SIGTERM, queue: q)
        termSrc.setEventHandler { stopFlag.set() }
        termSrc.resume()
    }

    private static func parseArgs() -> Double {
        var interval = 2.0
        var args = CommandLine.arguments.dropFirst().makeIterator()
        while let a = args.next() {
            if a == "--interval" || a == "-i" {
                if let v = args.next(), let d = Double(v), d > 0 {
                    interval = d
                }
            }
        }
        return interval
    }

    private static func sessionDirectoryURL() throws -> URL {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone.current
        fmt.dateFormat = "yyyyMMdd_HHmmss"
        let name = "session_\(fmt.string(from: Date()))"
        let root = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("beboppin-sessions", isDirectory: true)
        let dir = root.appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("screenshots"), withIntermediateDirectories: true)
        return dir
    }

    private static func monitorInfo() -> NDJSONFrame.Monitor {
        let id = CGMainDisplayID()
        let bounds = CGDisplayBounds(id)
        return NDJSONFrame.Monitor(
            width: Int(bounds.width.rounded()),
            height: Int(bounds.height.rounded()),
            left: Int(bounds.origin.x.rounded()),
            top: Int(bounds.origin.y.rounded())
        )
    }

    private static func scaleFactor() -> Double {
        Double(NSScreen.main?.backingScaleFactor ?? 2.0)
    }

    private static func run() async {
        installSignalHandlers()
        let interval = parseArgs()

        let sessionDir: URL
        do {
            sessionDir = try sessionDirectoryURL()
        } catch {
            fputs("beboppin: could not create session directory: \(error)\n", stderr)
            exit(1)
        }

        let storeURL = sessionDir.appendingPathComponent("store.sqlite")
        let jsonlURL = sessionDir.appendingPathComponent("frames.jsonl")
        FileManager.default.createFile(atPath: jsonlURL.path, contents: nil)

        let store: Store
        let jsonl: FileHandle
        do {
            store = try Store(path: storeURL)
            jsonl = try FileHandle(forWritingTo: jsonlURL)
            try jsonl.seekToEnd()
        } catch {
            fputs("beboppin: could not open store/jsonl: \(error)\n", stderr)
            exit(1)
        }

        defer {
            try? jsonl.synchronize()
            try? jsonl.close()
            store.close()
        }

        var hasKeptFrame = false
        var prevApp: String?
        var prevDisplay: UInt32?
        var prevPhash: UInt64?

        while !stopFlag.get() {
            let appName = NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"
            let displayID = CGMainDisplayID()

            let rawImage: CGImage
            do {
                guard let img = try await DisplayCapture.captureMainDisplay() else {
                    await Clock.sleep(interval: interval)
                    continue
                }
                rawImage = img
            } catch {
                await Clock.sleep(interval: interval)
                continue
            }

            let image = DisplayCapture.resizedForJPEG(rawImage)

            let decision: ChangeGate.Decision
            if !hasKeptFrame {
                let ph = ChangeGate.phash(of: image)
                decision = .keep(reason: "startup", phash: ph)
            } else if let pApp = prevApp, let pDisp = prevDisplay {
                decision = ChangeGate.evaluate(
                    previousApp: pApp,
                    previousDisplay: pDisp,
                    previousPhash: prevPhash,
                    appName: appName,
                    displayID: displayID,
                    image: image
                )
            } else {
                let ph = ChangeGate.phash(of: image)
                decision = .keep(reason: "startup", phash: ph)
            }

            switch decision {
            case .skip:
                break
            case .keep(let reason, let phash):
                let ts = Clock.nowUnixSeconds()
                let fileStem = Clock.fileTimestamp(from: ts)
                let relPath = "screenshots/\(fileStem).jpg"
                let absPath = sessionDir.appendingPathComponent(relPath)

                guard let jpeg = DisplayCapture.jpegData(from: image) else {
                    break
                }
                do {
                    try jpeg.write(to: absPath)
                } catch {
                    fputs("beboppin: could not write JPEG: \(error)\n", stderr)
                    break
                }

                let boxes: [OCRBox]
                do {
                    boxes = try await OCR.recognizeText(in: image)
                } catch {
                    fputs("beboppin: OCR failed: \(error)\n", stderr)
                    break
                }

                let merged = OCR.mergedText(from: boxes)

                do {
                    _ = try store.insertFrame(
                        timestamp: ts,
                        appName: appName,
                        displayID: displayID,
                        imageRelativePath: relPath,
                        phash: phash,
                        reason: reason,
                        ocrBoxes: boxes
                    )
                } catch {
                    fputs("beboppin: sqlite insert failed: \(error)\n", stderr)
                    break
                }

                let nd = NDJSONFrame(
                    timestamp: ts,
                    app_name: appName,
                    reason: reason,
                    display_id: displayID,
                    scale_factor: scaleFactor(),
                    monitor: monitorInfo(),
                    screenshot_path: relPath,
                    ocr_text: merged,
                    ocr_boxes: boxes.map {
                        NDJSONFrame.OCRBoxEncodable(text: $0.text, x: $0.x, y: $0.y, w: $0.w, h: $0.h)
                    }
                )

                do {
                    let line = try Emit.encodeLine(nd)
                    Emit.writeLineStdout(line)
                    Emit.writeLine(line, fileHandle: jsonl)
                    try jsonl.synchronize()
                } catch {
                    fputs("beboppin: emit failed: \(error)\n", stderr)
                }

                hasKeptFrame = true
                prevApp = appName
                prevDisplay = displayID
                prevPhash = phash
            }

            await Clock.sleep(interval: interval)
        }
    }
}
