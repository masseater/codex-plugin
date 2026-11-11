import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { insertIssue } from "../../__tests__/issues.ts";
import { type DB, openDb } from "./db.ts";
import { search } from "./search.ts";

vi.mock("bun:sqlite", () => import("../../__tests__/bun-sqlite.ts"));

describe("search（FTS5 trigram との結合）", () => {
  let db: DB;
  beforeEach(() => {
    db = openDb(":memory:");
    insertIssue(db, {
      number: 1,
      title: "TypeScript compile error",
      body: "cannot build",
      labels_json: '["bug"]',
      updated_at: new Date().toISOString(),
    });
    insertIssue(db, {
      number: 2,
      title: "TypeScript compile warning",
      state: "closed",
      labels_json: '["docs"]',
      updated_at: "2020-01-01T00:00:00Z",
    });
    insertIssue(db, { number: 3, title: "関係ない話題", state: "closed" });
  });
  afterEach(() => {
    db.close();
  });

  it("スコアの高い順に候補を返す", () => {
    const out = search(db, "TypeScript compile error");
    expect(out.map((c) => c.number)).toEqual([1, 2]);
    expect(out[0]).toMatchObject({ state: "open", labels: ["bug"] });
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
  });

  it("includeClosed=false で closed を除く", () => {
    expect(search(db, "TypeScript compile", { includeClosed: false }).map((c) => c.number)).toEqual(
      [1],
    );
  });

  it("limit で件数を絞る", () => {
    expect(search(db, "TypeScript compile", { limit: 1 })).toHaveLength(1);
  });

  it("queryLabels が一致する候補の labelJaccard が正になる", () => {
    const out = search(db, "TypeScript compile", { queryLabels: ["BUG"] });
    expect(out.find((c) => c.number === 1)!.labelJaccard).toBeGreaterThan(0);
    expect(out.find((c) => c.number === 2)!.labelJaccard).toBe(0);
  });

  it("検索語が短すぎる、または一致が無いときは空を返す", () => {
    expect(search(db, "ab")).toEqual([]);
    expect(search(db, "zzzzzz")).toEqual([]);
  });

  it("state が open / closed 以外の行は候補から外す", () => {
    db.run("UPDATE issues SET state = 'weird' WHERE number = 1");
    expect(search(db, "TypeScript compile error").map((c) => c.number)).toEqual([2]);
  });
});
