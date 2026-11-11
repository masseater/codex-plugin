import { describe, expect, it } from "vite-plus/test";
import { Database } from "./bun-sqlite.ts";

const open = () => {
  const db = new Database(":memory:");
  db.run("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
  return db;
};

// Vitest 用の bun:sqlite 代替が、本物と同じ呼び出し口・戻り値で動くことを確かめる
describe("bun:sqlite 代替の Database", () => {
  it("run のパラメータを束ね、query が行を返す（行が無ければ get は null）", () => {
    const db = open();
    db.run("INSERT INTO t VALUES (?, ?)", [1, "a"]);
    const q = db.query("SELECT name FROM t WHERE id = ?");
    expect(q.get(1)).toEqual({ name: "a" });
    expect(q.get(2)).toBeNull();
    expect(db.query("SELECT id FROM t").all()).toEqual([{ id: 1 }]);
    db.close();
  });

  it("prepare した文を繰り返し実行できる", () => {
    const db = open();
    const insert = db.prepare("INSERT INTO t VALUES (?, ?)");
    insert.run(1, "a");
    insert.run(2, "b");
    expect(db.query("SELECT COUNT(*) AS n FROM t").get()).toEqual({ n: 2 });
    db.close();
  });

  it("transaction は成功で commit し、throw で rollback する", () => {
    const db = open();
    const insertAll = db.transaction((rows: [number, string][]) => {
      for (const row of rows) db.run("INSERT INTO t VALUES (?, ?)", row);
      if (rows.some(([, name]) => name === "bad")) throw new Error("bad name");
    });
    insertAll([
      [1, "a"],
      [2, "b"],
    ]);
    expect(() =>
      insertAll([
        [3, "c"],
        [4, "bad"],
      ]),
    ).toThrow("bad name");
    expect(db.query("SELECT name FROM t ORDER BY id").all()).toEqual([
      { name: "a" },
      { name: "b" },
    ]);
    db.close();
  });
});
