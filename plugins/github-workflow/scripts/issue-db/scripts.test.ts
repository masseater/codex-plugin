import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { openDb } from "../../lib/issue-db/db.ts";
import { dbPathFor } from "../../lib/issue-db/repo.ts";
import { runCli } from "../../__tests__/run-cli.ts";
import { insertIssue } from "../../__tests__/issues.ts";

vi.mock("bun:sqlite", () => import("../../__tests__/bun-sqlite.ts"));

const getOctokit = vi.hoisted(() => vi.fn());
vi.mock("../../lib/octokit.ts", () => ({ getOctokit }));

const numbersOf = (rows: { number: number }[]): number[] => rows.map((r) => r.number);

async function* emptyPages() {
  yield { data: [] };
}

const ref = { host: "github.com", owner: "o", repo: "r" };
const repoArgs = ["--owner", "o", "--repo", "r"];

describe("issue-db CLI scripts", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "ghidb-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
    const db = openDb(dbPathFor(ref, tmp));
    insertIssue(db, {
      number: 1,
      title: "Login crash",
      author: "alice",
      labels_json: '["bug","p1"]',
      updated_at: "2026-03-01T00:00:00Z",
    });
    insertIssue(db, {
      number: 2,
      title: "Login docs",
      author: "bob",
      state: "closed",
      labels_json: '["docs"]',
      updated_at: "2026-02-01T00:00:00Z",
    });
    insertIssue(db, {
      number: 3,
      title: "Third",
      author: "alice",
      updated_at: "2026-01-01T00:00:00Z",
    });
    db.close();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
  });

  const listNumbers = async (...args: string[]) => {
    const run = await runCli(() => import("./list.ts"), [...repoArgs, ...args]);
    return numbersOf(JSON.parse(run.stdout).rows);
  };

  describe("list", () => {
    it("既定では open の issue を更新が新しい順に返す", async () => {
      expect(await listNumbers()).toEqual([1, 3]);
    });

    it("state=all で closed も含める", async () => {
      expect(await listNumbers("--state", "all")).toEqual([1, 2, 3]);
    });

    it("label は AND、authored-by と updated-since で絞り、limit で件数を制限する", async () => {
      expect(await listNumbers("--state", "all", "--label", "bug, p1")).toEqual([1]);
      expect(await listNumbers("--state", "all", "--label", "bug,docs")).toEqual([]);
      expect(await listNumbers("--state", "all", "--authored-by", "bob")).toEqual([2]);
      expect(
        await listNumbers("--state", "all", "--updated-since", "2026-02-01T00:00:00Z"),
      ).toEqual([1, 2]);
      expect(await listNumbers("--state", "all", "--limit", "1")).toEqual([1]);
      expect(await listNumbers("--state", "all", "--limit", "x")).toEqual([1, 2, 3]);
    });

    it("numbers を指定すると他の条件を無視してその番号だけ返す", async () => {
      expect(await listNumbers("--numbers", "2, 3,zzz", "--label", "nope")).toEqual([2, 3]);
      expect(await listNumbers("--numbers", "zzz")).toEqual([]);
    });
  });

  describe("search", () => {
    const search = (...args: string[]) =>
      runCli(() => import("./search.ts"), ["Login", ...repoArgs, ...args]);

    it("FTS の候補を JSON で出す", async () => {
      const out = JSON.parse((await search()).stdout);
      expect(numbersOf(out.candidates).toSorted((a, b) => a - b)).toEqual([1, 2]);
    });

    it("openOnly で closed を除き、limit で件数を絞る", async () => {
      expect(numbersOf(JSON.parse((await search("--openOnly")).stdout).candidates)).toEqual([1]);
      expect(JSON.parse((await search("--limit", "1")).stdout).candidates).toHaveLength(1);
    });
  });

  describe("show", () => {
    const show = (...args: string[]) => runCli(() => import("./show.ts"), [...args, ...repoArgs]);

    it("キャッシュにある issue を出力する", async () => {
      const run = await show("1");
      expect(JSON.parse(run.stdout)).toMatchObject({ number: 1, title: "Login crash" });
      expect(run.exitCodes).toEqual([]);
    });

    it("キャッシュに無ければ stderr に出して exit 1 にする", async () => {
      const run = await show("99");
      expect(run.stderr).toContain("not in cache: #99");
      expect(run.exitCodes[0]).toBe(1);
    });

    it("番号が整数でなければ失敗として終了する", async () => {
      const run = await show("abc");
      expect(run.stdout).toBe("");
      expect(run.exitCodes).toEqual([1]);
    });
  });

  describe("sync", () => {
    it("octokit で同期した結果を JSON で出す", async () => {
      getOctokit.mockReturnValue({
        rest: {
          search: { issuesAndPullRequests: async () => ({ data: { total_count: 3 } }) },
          issues: { listForRepo: vi.fn() },
        },
        paginate: { iterator: emptyPages },
      });

      const run = await runCli(() => import("./sync.ts"), [...repoArgs, "--force"]);

      expect(getOctokit).toHaveBeenCalledWith(ref);
      expect(JSON.parse(run.stdout)).toMatchObject({
        ref,
        mode: "full",
        upserted: 0,
        totalAfterSync: 3,
        dbPath: dbPathFor(ref, tmp),
      });
    });
  });
});
