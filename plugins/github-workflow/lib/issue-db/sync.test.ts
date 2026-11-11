import { Octokit } from "octokit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { type DB, getMeta, openDb, setMeta } from "./db.ts";
import { sync } from "./sync.ts";

vi.mock("bun:sqlite", () => import("../../__tests__/bun-sqlite.ts"));

const ref = { host: "github.com", owner: "o", repo: "r" };

type FakeIssue = Record<string, unknown>;

function issue(number: number, overrides: FakeIssue = {}): FakeIssue {
  return {
    number,
    title: `Issue number ${number}`,
    body: `body ${number}`,
    state: "open",
    state_reason: null,
    user: { login: "alice" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    closed_at: null,
    html_url: `https://example.test/${number}`,
    labels: [{ name: "bug" }, "p1"],
    comments: 0,
    ...overrides,
  };
}

function fakeOctokit(pages: FakeIssue[][], total = 1, comments: unknown[] = []) {
  const listForRepo = vi.fn();
  const listComments = vi.fn(async () => ({ data: comments }));
  const issuesAndPullRequests = vi.fn(async () => ({ data: { total_count: total } }));
  const iterator = vi.fn(async function* (_listFn: unknown, _params: object) {
    for (const data of pages) yield { data };
  });
  // 本物の Octokit（通信はしない）の rest / paginate だけを差し替える
  const octokit = Object.assign(new Octokit(), {
    rest: { search: { issuesAndPullRequests }, issues: { listForRepo, listComments } },
    paginate: { iterator },
  });
  return { octokit, iterator, listComments, listForRepo };
}

describe("sync", () => {
  let db: DB;
  const log = vi.fn();
  beforeEach(() => {
    db = openDb(":memory:");
  });
  afterEach(() => {
    db.close();
    log.mockReset();
  });

  const rows = () =>
    db.query<{ number: number; author: string | null; labels_json: string }, []>(
      "SELECT number, author, labels_json FROM issues ORDER BY number",
    );

  it("初回は全件同期し、PR を除いて保存し、同期メタを記録する", async () => {
    const pr = issue(2, { pull_request: { url: "x" } });
    const { octokit, iterator } = fakeOctokit(
      [[issue(1), pr], [pr], [issue(3, { user: null })]],
      2,
    );

    const result = await sync(db, octokit, ref, { log });

    expect(result).toEqual({ mode: "full", upserted: 2, totalAfterSync: 2 });
    expect(rows().all()).toEqual([
      { number: 1, author: "alice", labels_json: '["bug","p1"]' },
      { number: 3, author: null, labels_json: '["bug","p1"]' },
    ]);
    expect(iterator.mock.calls[0]?.[1]).not.toHaveProperty("since");
    expect(getMeta(db, "total_at_last_sync")).toBe("2");
    expect(getMeta(db, "last_full_sync")).toBeDefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("full sync for o/r"));
  });

  it("コメントのある issue はコメント抜粋を保存する", async () => {
    const comments = [{ user: null, created_at: "2026-01-03T00:00:00Z", body: "x".repeat(500) }];
    const { octokit, listComments } = fakeOctokit(
      [[issue(1, { comments: 1, body: null })]],
      1,
      comments,
    );

    await sync(db, octokit, ref, { log });

    expect(listComments).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 1 }));
    const saved = db
      .query<{ body: string; comments_json: string }, []>("SELECT body, comments_json FROM issues")
      .get();
    expect(saved?.body).toBe("");
    expect(JSON.parse(saved?.comments_json ?? "")).toEqual([
      { author: "unknown", created_at: "2026-01-03T00:00:00Z", body: "x".repeat(400) },
    ]);
  });

  it("コメントの本文が null でも空文字として保存する", async () => {
    const comments = [{ user: { login: "bob" }, created_at: "2026-01-03T00:00:00Z", body: null }];
    const { octokit } = fakeOctokit([[issue(1, { comments: 1 })]], 1, comments);
    await sync(db, octokit, ref, { log });
    const saved = db.query<{ comments_json: string }, []>("SELECT comments_json FROM issues").get();
    expect(JSON.parse(saved!.comments_json)).toEqual([
      { author: "bob", created_at: "2026-01-03T00:00:00Z", body: "" },
    ]);
  });

  it("前回同期があり総数の変化が小さければ since 付きの差分同期にする", async () => {
    setMeta(db, "last_sync", "2026-01-01T00:01:00Z");
    setMeta(db, "total_at_last_sync", "100");
    const { octokit, iterator } = fakeOctokit([[issue(1)]], 101);

    const result = await sync(db, octokit, ref, { log });

    expect(result.mode).toBe("incremental");
    expect(iterator.mock.calls[0]?.[1]).toMatchObject({ since: "2026-01-01T00:00:00.000Z" });
    expect(getMeta(db, "last_full_sync")).toBeUndefined();
  });

  it("force 指定なら差分同期できる状態でも全件同期する", async () => {
    setMeta(db, "last_sync", "2026-01-01T00:01:00Z");
    setMeta(db, "total_at_last_sync", "100");
    const { octokit } = fakeOctokit([], 100);
    expect((await sync(db, octokit, ref, { force: true, log })).mode).toBe("full");
  });

  it("log を省略すると stderr に出す", async () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      await sync(db, fakeOctokit([[issue(1)]]).octokit, ref);
      expect(write).toHaveBeenCalledWith(expect.stringContaining("[github-workflow] full sync"));
    } finally {
      write.mockRestore();
    }
  });

  it("再同期で title が変わった issue は、旧 title の語では検索にヒットしなくなる", async () => {
    const run = (title: string) =>
      sync(db, fakeOctokit([[issue(1, { title })]]).octokit, ref, { log, force: true });
    const match = (term: string) =>
      db
        .query<{ rowid: number }, [string]>("SELECT rowid FROM issues_fts WHERE issues_fts MATCH ?")
        .all(`"${term}"`);

    await run("Unique zebra title");
    expect(match("zebra")).toEqual([{ rowid: 1 }]);
    await run("Unique giraffe title");
    expect(match("zebra")).toEqual([]);
    expect(match("giraffe")).toEqual([{ rowid: 1 }]);
  });
});
