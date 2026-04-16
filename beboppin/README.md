# beboppin

Hackable macOS CLI daemon: capture the main display ~every 2s, OCR with Vision, log the frontmost app, change-gate on app/display/perceptual hash, and persist to SQLite+FTS4 plus a per-frame NDJSON stream (stdout + `frames.jsonl`).

**Minimum macOS:** 13 (Ventura).

## Build

```bash
cd beboppin
swift build
# or release:
swift build -c release
```

Or use `./run.sh` (wraps `swift run beboppin`).

## Run

```bash
swift run beboppin
# optional tick interval (seconds), default 2:
swift run beboppin --interval 2.5
```

On first run, grant **Screen Recording** when macOS prompts (System Settings → Privacy & Security → Screen Recording). Without it, capture falls back to `CGDisplayCreateImage` when possible; ScreenCaptureKit may fail until permission is granted.

Stop with **Ctrl+C** or **SIGTERM**; SQLite and `frames.jsonl` are flushed on exit.

## Session layout

Each run creates:

`~/beboppin-sessions/session_YYYYMMDD_HHMMSS/`

- `frames.jsonl` — one JSON object per kept frame (NDJSON)
- `store.sqlite` — `frames`, `framesText`, FTS4 `allText`
- `screenshots/*.jpg` — JPEG for each kept frame

## NDJSON shape

Each line matches the documented pipeline-friendly shape: `timestamp`, `app_name`, `reason`, `display_id`, `scale_factor`, `monitor` (`width`, `height`, `left`, `top`), `screenshot_path` (relative to session root), `ocr_text`, `ocr_boxes` (`text`, `x`, `y`, `w`, `h`).

## SQLite schema

See the design doc in your notes; tables: `frames` (with `phash` blob, `reason`), `framesText`, virtual `allText` FTS4 on `(frame_id UNINDEXED, text)`.

Example queries:

```bash
sqlite3 ~/beboppin-sessions/session_*/store.sqlite \
  "SELECT app_name, COUNT(*) FROM frames GROUP BY app_name;"

sqlite3 ~/beboppin-sessions/session_*/store.sqlite \
  "SELECT frame_id FROM allText WHERE text MATCH 'beboppin';"
```

## Implementation note (Swift entry)

The executable entry point lives in `Sources/beboppin/Beboppin.swift`. Swift treats a file named `main.swift` as top-level script code, which conflicts with `@main`, so the entry file is not named `main.swift`.

## Change-gate

- First kept frame: `startup`
- App change: `app_switch`
- Main display id change: `display_change`
- Same app + display: 64-bit DCT pHash; keep if Hamming distance ≥ 5 vs previous kept frame (`pixel_diff`)

## Storage

Roughly ~100–400 MB/hour depending on deduplication; tune JPEG quality in `DisplayCapture.jpegData` and max width in `resizedForJPEG` if needed.
