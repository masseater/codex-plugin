import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Database } from "../../__tests__/bun-sqlite.ts";
import { getMeta, openDb, setMeta } from "./db.ts";

vi.mock("bun:sqlite", () => import("../../__tests__/bun-sqlite.ts"));

describe("openDb", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "issue-db-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("新規 DB を最新のスキーマバージョンで作る", () => {
    const db = openDb(":memory:");
    expect(getMeta(db, "schema_version")).toBe("2");
    db.close();
  });

  it("getMeta / setMeta は値を上書きして読み出す", () => {
    const db = openDb(":memory:");
    expect(getMeta(db, "k")).toBeUndefined();
    setMeta(db, "k", "v1");
    setMeta(db, "k", "v2");
    expect(getMeta(db, "k")).toBe("v2");
    db.close();
  });

  it("v1 の DB を開くと embeddings を捨て、trigram で FTS を作り直し、同期メタを消す", () => {
    const file = path.join(dir, "v1.sqlite");
    const v1 = new Database(file);
    v1.run("CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    v1.run("CREATE TABLE embeddings (number INTEGER PRIMARY KEY)");
    v1.run("CREATE VIRTUAL TABLE issues_fts USING fts5(title, body, labels, content='')");
    v1.run("INSERT INTO sync_meta VALUES ('schema_version', '1'), ('last_sync', 'x')");
    v1.close();

    const db = openDb(file);
    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE name IN ('embeddings')")
      .all();
    const fts = db.query<{ sql: string }, []>(
      "SELECT sql FROM sqlite_master WHERE name = 'issues_fts'",
    );
    expect(tables).toEqual([]);
    expect(fts.get()?.sql).toContain("trigram");
    expect(getMeta(db, "last_sync")).toBeUndefined();
    expect(getMeta(db, "schema_version")).toBe("2");
    db.close();
  });

  it("trigram 版の FTS を持つ旧バージョンの DB は FTS を残したままバージョンだけ更新する", () => {
    const file = path.join(dir, "v1-trigram.sqlite");
    openDb(file).close();
    const raw = new Database(file);
    raw.run("UPDATE sync_meta SET value = '1' WHERE key = 'schema_version'");
    raw.run("INSERT INTO sync_meta VALUES ('last_sync', 'kept')");
    raw.close();

    const db = openDb(file);
    expect(getMeta(db, "last_sync")).toBe("kept");
    expect(getMeta(db, "schema_version")).toBe("2");
    db.close();
  });

  it.each([
    ["no such tokenizer: trigram", /FTS5 trigram tokenizer is not available/],
    ["no such module: fts5", /FTS5 is not enabled/],
    ["disk I/O error", /DDL failed: disk I\/O error/],
    ["boom", /DDL failed: boom/],
  ])("DDL が %s で失敗したら原因を説明するエラーにする", (message, expected) => {
    vi.spyOn(Database.prototype, "run").mockImplementation((sql: string) => {
      if (sql.startsWith("CREATE TABLE IF NOT EXISTS issues (")) throw new Error(message);
    });
    expect(() => openDb(":memory:")).toThrow(expected);
    vi.restoreAllMocks();
  });

  it("Error 以外が投げられても文字列にして DDL 失敗として扱う", () => {
    vi.spyOn(Database.prototype, "run").mockImplementation((sql: string) => {
      if (sql.startsWith("CREATE INDEX")) throw "plain string";
    });
    expect(() => openDb(":memory:")).toThrow(/DDL failed: plain string/);
    vi.restoreAllMocks();
  });
});
