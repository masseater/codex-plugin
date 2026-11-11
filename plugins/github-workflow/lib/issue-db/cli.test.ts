import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parseLimit, resolveRepoRef, withIssueDb } from "./cli.ts";
import * as repo from "./repo.ts";

vi.mock("bun:sqlite", () => import("../../__tests__/bun-sqlite.ts"));

describe("resolveRepoRef", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("owner と repo があれば host 省略時に github.com を使う", () => {
    expect(resolveRepoRef({ owner: "o", repo: "r" })).toEqual({
      host: "github.com",
      owner: "o",
      repo: "r",
    });
    expect(resolveRepoRef({ host: "ghe.test", owner: "o", repo: "r" }).host).toBe("ghe.test");
  });

  it("どちらかが欠けていれば git remote から解決する", () => {
    const fromGit = { host: "github.com", owner: "git-o", repo: "git-r" };
    const spy = vi.spyOn(repo, "resolveRepoFromGit").mockReturnValue(fromGit);
    expect(resolveRepoRef({ owner: "o" })).toBe(fromGit);
    expect(resolveRepoRef({})).toBe(fromGit);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("parseLimit", () => {
  it("整数として読めれば数値、読めなければ fallback", () => {
    expect(parseLimit("25", 10)).toBe(25);
    expect(parseLimit("abc", 10)).toBe(10);
  });
});

describe("withIssueDb", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "ghidb-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("DB を開いて fn を実行し、戻り値と DB パスを渡す", async () => {
    const ref = { host: "github.com", owner: "o", repo: "r" };
    const result = await withIssueDb(ref, async (db, dbPath) => {
      expect(db.query<{ n: number }, []>("SELECT 1 AS n").get()?.n).toBe(1);
      return dbPath;
    });
    expect(result).toBe(path.join(tmp, ".agents/cache/issues/o-r.sqlite"));
  });

  it("fn が throw しても DB を閉じる", async () => {
    const ref = { host: "github.com", owner: "o", repo: "r" };
    let captured: { query: (sql: string) => unknown } | undefined;
    await expect(
      withIssueDb(ref, (db) => {
        captured = db;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(() => captured?.query("SELECT 1")).toThrow("not open");
  });
});
