import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

function resolveDefaultDbPath(): string {
  const stateDir = process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`;
  return `${stateDir}/claude-code-plugin/discord-notify/sessions.db`;
}

function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? resolveDefaultDbPath();
  mkdirSync(dirname(resolvedPath), { recursive: true });
  return new Database(resolvedPath);
}

function ensureTable(db: Database.Database): void {
  db.prepare(`
		CREATE TABLE IF NOT EXISTS sessions (
			session_id TEXT PRIMARY KEY,
			thread_id TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`).run();
}

function saveSession(db: Database.Database, sessionId: string, threadId: string): void {
  db.prepare(
    `INSERT INTO sessions (session_id, thread_id)
		 VALUES (?, ?)
		 ON CONFLICT(session_id) DO UPDATE SET thread_id = excluded.thread_id`,
  ).run(sessionId, threadId);
}

function getThreadId(db: Database.Database, sessionId: string): string | null {
  const row = db
    .prepare<[string], { thread_id: string }>("SELECT thread_id FROM sessions WHERE session_id = ?")
    .get(sessionId);
  return row?.thread_id ?? null;
}

export { ensureTable, getThreadId, openDb, saveSession };
