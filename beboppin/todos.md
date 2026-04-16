# v0 close-out todos

Handoff to composer. Full plan at `/Users/caden/.claude/plans/yeah-lets-build-the-playful-ullman.md`.

## A. Rename `beboppin` → `mom`

Project is named `mom`. `beboppin` is the enclosing projects dir.

- [ ] Move `/Users/caden/Programming/beboppin/beboppin/` → `/Users/caden/Programming/beboppin/mom/`
- [ ] `Package.swift`: `name`, executable product, target → `"mom"`
- [ ] Rename `Sources/beboppin/` → `Sources/mom/`
- [ ] Rename `Sources/mom/Beboppin.swift` → `Mom.swift`; `enum Beboppin` → `enum Mom`
- [ ] Update `fputs` prefixes: `"beboppin: ..."` → `"mom: ..."`
- [ ] `run.sh`: `swift run beboppin` → `swift run mom`
- [ ] `README.md`: title + all references
- [ ] Session dir: `~/beboppin-sessions/` → `~/mom-sessions/` (update `Beboppin.swift:63` and `.gitignore`)
- [ ] `rm -rf .build && swift build` to verify

## B. Fixes from review

### Required

- [ ] **Signal handler retention bug** — `Mom.swift` (was `Beboppin.swift`) `installSignalHandlers()`: `intSrc`/`termSrc` are locals and get deallocated on return, silently breaking SIGINT/SIGTERM. Hoist to `static var` on `enum Mom` so they live for the process lifetime.

### Polish

- [ ] Drop per-frame `try jsonl.synchronize()` in the keep-branch of the main loop (`Beboppin.swift:221`). The `defer` on shutdown already flushes; per-frame fsync is unnecessary disk pressure.
- [ ] `Clock.sleep(interval:)` doc comment says "sleep until the next tick boundary" but it's a plain `Task.sleep`. Either rewrite the comment to match, or implement boundary tracking (record `lastTick`, sleep `max(0, interval - elapsed)`).
- [ ] `CGDisplayCreateImage` is deprecated on macOS 14+ (`Capture.swift:22`). Wrap in `#available` and use `SCScreenshotManager.captureImage(contentFilter:configuration:)` on 14+, or `@available` the fallback and accept the warning.
- [ ] `resizedForJPEG` CGContext uses `.premultipliedLast` (RGBA). For JPEG output, `.noneSkipLast` skips the alpha round-trip.
- [ ] `OCR.mergedText` joins in Vision's emitted order. Sort boxes by `(y rounded to line bucket, x)` before joining so the end-of-day summarizer gets readable text across columns.

Only A + B-required need to land for v0. B-polish is nice-to-have.
