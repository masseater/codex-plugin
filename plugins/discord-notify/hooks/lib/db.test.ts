import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureTable, getThreadId, openDb, saveSession } from "./db.ts";

describe("db", () => {
  let dbPath: string;
  let db: Database.Database;

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
