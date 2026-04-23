import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { getMeta, migrateIfNeeded, openDb, setMeta, splitStatements } from "./db.ts";

describe("splitStatements", () => {
  it("splits multi-statement SQL on semicolons", () => {
    expect(splitStatements("CREATE TABLE a(x); INSERT INTO a VALUES(1);")).toEqual([
      "CREATE TABLE a(x)",
      "INSERT INTO a VALUES(1)",
    ]);
  });
  it("filters empty statements", () => {
    expect(splitStatements(";;  ; CREATE TABLE a(x);")).toEqual(["CREATE TABLE a(x)"]);
  });
  it("returns empty for no-op input", () => {
    expect(splitStatements("")).toEqual([]);
    expect(splitStatements("  ;  ")).toEqual([]);
  });
});

describe("openDb", () => {
  it("creates schema at schema_version=2 on a fresh DB", () => {
    const db = openDb(":memory:");
    try {
      expect(getMeta(db, "schema_version")).toBe("2");
    } finally {
      db.close();
    }
  });

  it("creates FTS5 trigram table", () => {
    const db = openDb(":memory:");
    try {
      const row = db
        .query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE name = 'issues_fts'")
        .get();
      expect(row?.sql).toMatch(/trigram/);
    } finally {
      db.close();
    }
  });
});

describe("getMeta / setMeta", () => {
  it("round-trips values", () => {
    const db = openDb(":memory:");
    try {
      expect(getMeta(db, "nope")).toBeUndefined();
      setMeta(db, "k", "v");
      expect(getMeta(db, "k")).toBe("v");
      setMeta(db, "k", "v2");
      expect(getMeta(db, "k")).toBe("v2");
    } finally {
      db.close();
    }
  });
});

describe("migrateIfNeeded v1 → v2", () => {
  function makeV1(): ReturnType<typeof openDb> {
    // Simulate a v1 DB: unicode61 FTS table + embeddings table + schema_version=1.
    const db = new Database(":memory:", { create: true }) as ReturnType<typeof openDb>;
    db.run(`
      CREATE TABLE issues (
        number INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL,
        state_reason TEXT,
        author TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        url TEXT NOT NULL,
        labels_json TEXT NOT NULL DEFAULT '[]',
        comments_json TEXT NOT NULL DEFAULT '[]'
      )
    `);
    db.run(
      "CREATE VIRTUAL TABLE issues_fts USING fts5(title, body, labels, content='', tokenize='unicode61 remove_diacritics 2')",
    );
    db.run("CREATE TABLE embeddings (number INTEGER PRIMARY KEY, vector BLOB)");
    db.run("CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.run("INSERT INTO sync_meta VALUES ('schema_version', '1')");
    db.run("INSERT INTO sync_meta VALUES ('last_sync', '2026-01-01T00:00:00Z')");
    db.run("INSERT INTO sync_meta VALUES ('total_at_last_sync', '42')");
    return db;
  }

  it("drops embeddings table, rebuilds FTS with trigram, and resets sync_meta", () => {
    const db = makeV1();
    try {
      migrateIfNeeded(db);
      // embeddings gone
      expect(
        db
          .query<{ n: number }, []>(
            "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'embeddings'",
          )
          .get()?.n,
      ).toBe(0);
      // issues_fts now uses trigram
      const fts = db
        .query<{ sql: string }, []>("SELECT sql FROM sqlite_master WHERE name = 'issues_fts'")
        .get();
      expect(fts?.sql).toMatch(/trigram/);
      // Sync meta reset so next run does a full sync
      expect(
        db
          .query<{ n: number }, []>("SELECT COUNT(*) AS n FROM sync_meta WHERE key = 'last_sync'")
          .get()?.n,
      ).toBe(0);
    } finally {
      db.close();
    }
  });

  it("is idempotent at current schema version", () => {
    const db = openDb(":memory:");
    try {
      expect(() => migrateIfNeeded(db)).not.toThrow();
      expect(() => migrateIfNeeded(db)).not.toThrow();
    } finally {
      db.close();
    }
  });
});
