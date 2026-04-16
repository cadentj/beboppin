import Foundation
import SQLite3

/// SQLite copies string/blob data before returning; matches `SQLITE_TRANSIENT`.
private let sqliteTransient: sqlite3_destructor_type = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

/// SQLite persistence: `frames`, `framesText`, FTS4 `allText`.
final class Store {
    private var db: OpaquePointer?

    private var insertFrameStmt: OpaquePointer?
    private var insertTextStmt: OpaquePointer?
    private var insertFtsStmt: OpaquePointer?

    init(path: URL) throws {
        if sqlite3_open_v2(path.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            throw StoreError.openFailed(String(cString: sqlite3_errmsg(db)))
        }
        try exec("PRAGMA foreign_keys = ON;")
        try exec("PRAGMA journal_mode = WAL;")
        try migrate()
        try prepareStatements()
    }

    deinit {
        finalizeStatements()
        if let db {
            sqlite3_close(db)
        }
    }

    func close() {
        finalizeStatements()
        if let db {
            sqlite3_close(db)
        }
        self.db = nil
    }

    /// Insert frame and text rows; returns new `frames.id`.
    func insertFrame(
        timestamp: Double,
        appName: String,
        displayID: UInt32,
        imageRelativePath: String,
        phash: UInt64,
        reason: String,
        ocrBoxes: [OCRBox]
    ) throws -> Int64 {
        guard let stmt = insertFrameStmt else { throw StoreError.notOpen }

        sqlite3_reset(stmt)
        sqlite3_clear_bindings(stmt)
        sqlite3_bind_double(stmt, 1, timestamp)
        try bindText(stmt, index: 2, appName)
        sqlite3_bind_int64(stmt, 3, Int64(displayID))
        try bindText(stmt, index: 4, imageRelativePath)
        var be = phash.bigEndian
        let phashData = Data(bytes: &be, count: MemoryLayout<UInt64>.size)
        _ = phashData.withUnsafeBytes { buf in
            sqlite3_bind_blob(stmt, 5, buf.baseAddress, Int32(buf.count), sqliteTransient)
        }
        try bindText(stmt, index: 6, reason)

        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw StoreError.stepFailed(String(cString: sqlite3_errmsg(db)))
        }
        let rowId = sqlite3_last_insert_rowid(db)

        let merged = OCR.mergedText(from: ocrBoxes)
        try insertFrameTextRows(frameId: rowId, boxes: ocrBoxes)
        try insertFts(frameId: rowId, text: merged)

        return rowId
    }

    private func insertFrameTextRows(frameId: Int64, boxes: [OCRBox]) throws {
        guard let stmt = insertTextStmt else { throw StoreError.notOpen }
        for box in boxes {
            sqlite3_reset(stmt)
            sqlite3_clear_bindings(stmt)
            sqlite3_bind_int64(stmt, 1, frameId)
            try bindText(stmt, index: 2, box.text)
            sqlite3_bind_double(stmt, 3, box.x)
            sqlite3_bind_double(stmt, 4, box.y)
            sqlite3_bind_double(stmt, 5, box.w)
            sqlite3_bind_double(stmt, 6, box.h)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw StoreError.stepFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    private func insertFts(frameId: Int64, text: String) throws {
        guard let stmt = insertFtsStmt else { throw StoreError.notOpen }
        sqlite3_reset(stmt)
        sqlite3_clear_bindings(stmt)
        sqlite3_bind_int64(stmt, 1, frameId)
        try bindText(stmt, index: 2, text)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw StoreError.stepFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    private func migrate() throws {
        try exec(
            """
            CREATE TABLE IF NOT EXISTS frames (
              id          INTEGER PRIMARY KEY,
              timestamp   REAL NOT NULL,
              app_name    TEXT NOT NULL,
              display_id  INTEGER NOT NULL,
              image_path  TEXT NOT NULL,
              phash       BLOB NOT NULL,
              reason      TEXT NOT NULL
            );
            """
        )
        try exec("CREATE INDEX IF NOT EXISTS idx_frames_ts ON frames(timestamp);")
        try exec("CREATE INDEX IF NOT EXISTS idx_frames_app ON frames(app_name);")

        try exec(
            """
            CREATE TABLE IF NOT EXISTS framesText (
              id       INTEGER PRIMARY KEY,
              frame_id INTEGER NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
              text     TEXT NOT NULL,
              x        REAL NOT NULL,
              y        REAL NOT NULL,
              w        REAL NOT NULL,
              h        REAL NOT NULL
            );
            """
        )
        try exec("CREATE INDEX IF NOT EXISTS idx_framesText_frame ON framesText(frame_id);")

        try exec(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS allText USING fts4(frame_id UNINDEXED, text);
            """
        )
    }

    private func prepareStatements() throws {
        let insertFrameSQL = """
        INSERT INTO frames (timestamp, app_name, display_id, image_path, phash, reason)
        VALUES (?, ?, ?, ?, ?, ?);
        """
        if sqlite3_prepare_v2(db, insertFrameSQL, -1, &insertFrameStmt, nil) != SQLITE_OK {
            throw StoreError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }

        let insertTextSQL = """
        INSERT INTO framesText (frame_id, text, x, y, w, h)
        VALUES (?, ?, ?, ?, ?, ?);
        """
        if sqlite3_prepare_v2(db, insertTextSQL, -1, &insertTextStmt, nil) != SQLITE_OK {
            throw StoreError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }

        let insertFtsSQL = """
        INSERT INTO allText (frame_id, text) VALUES (?, ?);
        """
        if sqlite3_prepare_v2(db, insertFtsSQL, -1, &insertFtsStmt, nil) != SQLITE_OK {
            throw StoreError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    private func finalizeStatements() {
        if let s = insertFrameStmt { sqlite3_finalize(s) }
        insertFrameStmt = nil
        if let s = insertTextStmt { sqlite3_finalize(s) }
        insertTextStmt = nil
        if let s = insertFtsStmt { sqlite3_finalize(s) }
        insertFtsStmt = nil
    }

    private func exec(_ sql: String) throws {
        var err: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &err) != SQLITE_OK {
            let msg = err.map { String(cString: $0) } ?? String(cString: sqlite3_errmsg(db))
            sqlite3_free(err)
            throw StoreError.execFailed(msg)
        }
    }

    private func bindText(_ stmt: OpaquePointer?, index: Int32, _ value: String) throws {
        let rc = value.withCString { sqlite3_bind_text(stmt, index, $0, -1, sqliteTransient) }
        guard rc == SQLITE_OK else {
            throw StoreError.bindFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    enum StoreError: Error {
        case openFailed(String)
        case notOpen
        case execFailed(String)
        case prepareFailed(String)
        case stepFailed(String)
        case bindFailed(String)
    }
}
