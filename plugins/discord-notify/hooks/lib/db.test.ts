import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("better-sqlite3", () => {
  return {
    default: class FakeDatabase {
      private readonly path: string;
      private readonly sessions = new Map<string, string>();

      constructor(path: string) {
        this.path = path;
      }

      prepare(sql: string) {
        const normalized = sql.replaceAll(/\s+/g, " ").trim();

        if (normalized.includes("CREATE TABLE IF NOT EXISTS sessions")) {
          return {
            run: () => undefined,
          };
        }

        if (
          normalized === "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
        ) {
          return {
            all: () => [{ name: "sessions" }],
          };
        }

        if (normalized.startsWith("INSERT INTO sessions (session_id, thread_id)")) {
          return {
            run: (sessionId: string, threadId: string) => {
              this.sessions.set(sessionId, threadId);
              return undefined;
            },
          };
        }

        if (normalized === "SELECT thread_id FROM sessions WHERE session_id = ?") {
          return {
            get: (sessionId: string) => {
              const threadId = this.sessions.get(sessionId);
              return threadId ? { thread_id: threadId } : undefined;
            },
          };
        }

        throw new Error(`Unsupported SQL in test fake: ${sql}`);
      }

      close() {
        return undefined;
      }
    },
  };
});

import { ensureTable, getThreadId, openDb, saveSession } from "./db.ts";

describe("db", () => {
  let dbPath: string;
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    dbPath = join(
      tmpdir(),
      `discord-notify-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    db = openDb(dbPath);
    ensureTable(db);
  });

  afterEach(() => {
    db.close();
    try {
      rmSync(dbPath);
    } catch {
      // cleanup best-effort
    }
  });

  describe("openDb", () => {
    it("creates database file at specified path", () => {
      expect(db).toBeDefined();
      expect((db as unknown as { path: string }).path).toBe(dbPath);
    });
  });

  describe("ensureTable", () => {
    it("creates sessions table", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it("is idempotent", () => {
      ensureTable(db);
      ensureTable(db);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .all();
      expect(tables).toHaveLength(1);
    });
  });

  describe("saveSession / getThreadId", () => {
    it("saves and retrieves a session-thread mapping", () => {
      saveSession(db, "session-1", "thread-100");
      expect(getThreadId(db, "session-1")).toBe("thread-100");
    });

    it("returns null for unknown session", () => {
      expect(getThreadId(db, "nonexistent")).toBeNull();
    });

    it("upserts on duplicate session_id", () => {
      saveSession(db, "session-1", "thread-100");
      saveSession(db, "session-1", "thread-200");
      expect(getThreadId(db, "session-1")).toBe("thread-200");
    });

    it("handles multiple sessions independently", () => {
      saveSession(db, "session-a", "thread-1");
      saveSession(db, "session-b", "thread-2");
      expect(getThreadId(db, "session-a")).toBe("thread-1");
      expect(getThreadId(db, "session-b")).toBe("thread-2");
    });
  });
});
