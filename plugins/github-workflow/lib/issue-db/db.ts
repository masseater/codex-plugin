import { Database } from "bun:sqlite";
import { DDL, SCHEMA_VERSION } from "./schema.ts";
import { splitStatements } from "./sql-statements.ts";

export type DB = Database;

export function openDb(filename: string): DB {
  const db = new Database(filename, { create: true });
  for (const stmt of splitStatements(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;",
  )) {
    db.run(stmt);
  }
  runDdl(db, DDL);
  migrateIfNeeded(db);
  ensureSchemaVersion(db);
  return db;
}

function runDdl(db: DB, ddl: string): void {
  for (const stmt of splitStatements(ddl)) {
    try {
      db.run(stmt);
    } catch (err) {
      throw wrapSqliteError(stmt, err);
    }
  }
}

/**
 * DDL の失敗が FTS5 trigram tokenizer の欠如によるものかを判定する。
 *
 * @param stmt - 失敗した文
 * @param message - SQLite のエラーメッセージ
 * @returns trigram に関するエラーなら true
 */
function isTrigramError(stmt: string, message: string): boolean {
  return /trigram/i.test(stmt) || /trigram/i.test(message) || /no such tokenizer/i.test(message);
}

function wrapSqliteError(stmt: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (isTrigramError(stmt, message)) {
    return new Error(
      `FTS5 trigram tokenizer is not available in this SQLite build. ` +
        `github-workflow needs bun:sqlite compiled with FTS5 + trigram (standard in Bun ≥1.1). ` +
        `Original error: ${message}`,
    );
  }
  if (/no such module: fts5/i.test(message)) {
    return new Error(
      `FTS5 is not enabled in this SQLite build. github-workflow requires FTS5. Original error: ${message}`,
    );
  }
  return new Error(`DDL failed: ${message}\nstatement: ${stmt.slice(0, 200)}`);
}

/**
 * sync_meta に記録されたスキーマバージョンを読む。
 *
 * @param db - issue DB
 * @returns スキーマバージョン。未記録なら 0
 */
function readSchemaVersion(db: DB): number {
  const row = db
    .query<{ value: string }, []>("SELECT value FROM sync_meta WHERE key = 'schema_version'")
    .get();
  return row ? Number.parseInt(row.value, 10) : 0;
}

/**
 * issues_fts が trigram 以外の tokenizer で作られているかを判定する。
 *
 * @param db - issue DB
 * @returns 旧 tokenizer の FTS テーブルがあれば true
 */
function hasLegacyFts(db: DB): boolean {
  const ftsRow = db
    .query<{ tokenize: string }, []>(
      "SELECT sql AS tokenize FROM sqlite_master WHERE name = 'issues_fts'",
    )
    .get();
  return ftsRow !== null && !ftsRow.tokenize.includes("trigram");
}

function migrateIfNeeded(db: DB): void {
  if (readSchemaVersion(db) === SCHEMA_VERSION) return;
  // v1 had an `embeddings` table + `unicode61` FTS tokenizer. v2 drops the
  // table and rebuilds FTS with `trigram`. Both are additive: the old table
  // is dropped here, and the FTS table is re-created idempotently by DDL.
  db.run("DROP TABLE IF EXISTS embeddings");
  // FTS5 table with different tokenize pragma can't be altered in place —
  // drop + recreate + force full re-sync downstream via sync_meta reset.
  if (hasLegacyFts(db)) {
    db.run("DROP TABLE IF EXISTS issues_fts");
    runDdl(db, DDL);
    db.run(
      "DELETE FROM sync_meta WHERE key IN ('last_sync', 'last_full_sync', 'total_at_last_sync')",
    );
  }
}

function ensureSchemaVersion(db: DB): void {
  if (readSchemaVersion(db) === SCHEMA_VERSION) return;
  db.run("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('schema_version', ?)", [
    String(SCHEMA_VERSION),
  ]);
}

export function getMeta(db: DB, key: string): string | undefined {
  const row = db
    .query<{ value: string }, [string]>("SELECT value FROM sync_meta WHERE key = ?")
    .get(key);
  return row?.value;
}

export function setMeta(db: DB, key: string, value: string): void {
  db.run("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)", [key, value]);
}
