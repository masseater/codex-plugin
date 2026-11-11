import type { Octokit } from "octokit";
import { getMeta, setMeta, type DB } from "./db.ts";
import type { CommentPreview } from "./schema.ts";
import { mapWithConcurrency } from "./concurrency.ts";
import type { RepoRef } from "./remote-url.ts";
import { parseLabels } from "./scoring.ts";
import { normalizeLabels, shouldForceFull, sinceWithSkew } from "./sync-rules.ts";

const COMMENT_PREVIEW_COUNT = 3;
const COMMENT_PREVIEW_CHARS = 400;
const COMMENT_FETCH_CONCURRENCY = 10;

type GhIssue = Awaited<ReturnType<Octokit["rest"]["issues"]["listForRepo"]>>["data"][number];

export type SyncResult = {
  mode: "full" | "incremental";
  upserted: number;
  totalAfterSync: number;
};

/**
 * 前回の同期時刻と、そのときの issue 総数を読む。
 *
 * @param db - issue DB
 * @returns 前回の同期時刻（未同期なら undefined）と issue 総数（未記録なら 0）
 */
function readLastSync(db: DB): { lastSync: string | undefined; lastTotal: number } {
  const lastTotalRaw = getMeta(db, "total_at_last_sync");
  return {
    lastSync: getMeta(db, "last_sync"),
    lastTotal: lastTotalRaw ? Number.parseInt(lastTotalRaw, 10) : 0,
  };
}

/**
 * 差分同期で取得を始める時刻を決める。
 *
 * @param mustFull - 全件同期するか
 * @param lastSync - 前回の同期時刻
 * @returns 差分同期なら前回時刻から少し遡った時刻。全件同期なら undefined
 */
function incrementalSince(mustFull: boolean, lastSync: string | undefined): string | undefined {
  return !mustFull && lastSync ? sinceWithSkew(lastSync) : undefined;
}

function recordSync(db: DB, mustFull: boolean, currentTotal: number): void {
  const nowIso = new Date().toISOString();
  setMeta(db, "last_sync", nowIso);
  if (mustFull) setMeta(db, "last_full_sync", nowIso);
  setMeta(db, "total_at_last_sync", String(currentTotal));
}

export async function sync(
  db: DB,
  octokit: Octokit,
  ref: RepoRef,
  opts: { force?: boolean; log?: (msg: string) => void } = {},
): Promise<SyncResult> {
  const log = opts.log ?? ((msg) => process.stderr.write(`${msg}\n`));
  const { lastSync, lastTotal } = readLastSync(db);

  const currentTotal = await fetchIssueCount(octokit, ref);
  const mustFull = shouldForceFull(currentTotal, lastTotal, Boolean(opts.force), lastSync);

  const mode = mustFull ? "full" : "incremental";
  log(
    `[github-workflow] ${mode} sync for ${ref.owner}/${ref.repo} (current total=${currentTotal})`,
  );

  const upserted = await paginateAndUpsert(
    db,
    octokit,
    ref,
    incrementalSince(mustFull, lastSync),
    log,
  );
  recordSync(db, mustFull, currentTotal);

  return { mode, upserted, totalAfterSync: currentTotal };
}

async function fetchIssueCount(octokit: Octokit, ref: RepoRef): Promise<number> {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${ref.owner}/${ref.repo} is:issue`,
    per_page: 1,
  });
  return data.total_count;
}

async function paginateAndUpsert(
  db: DB,
  octokit: Octokit,
  ref: RepoRef,
  since: string | undefined,
  log: (msg: string) => void,
): Promise<number> {
  const insertIssue = db.prepare<unknown, IssueInsertParams>(
    `INSERT OR REPLACE INTO issues
      (number, title, body, state, state_reason, author, created_at, updated_at, closed_at, url, labels_json, comments_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // contentless FTS5 の 'delete' は、登録時と同じ値を渡さないと索引が壊れる（未登録の rowid では malformed）。
  // そのため issues テーブルに残っている旧値を渡し、旧値が無い（新規の）issue では delete しない
  const selectOld = db.query<{ title: string; body: string; labels_json: string }, [number]>(
    "SELECT title, body, labels_json FROM issues WHERE number = ?",
  );
  const deleteFts = db.prepare<unknown, [number, string, string, string]>(
    "INSERT INTO issues_fts(issues_fts, rowid, title, body, labels) VALUES('delete', ?, ?, ?, ?)",
  );
  const insertFts = db.prepare<unknown, [number, string, string, string]>(
    "INSERT INTO issues_fts(rowid, title, body, labels) VALUES (?, ?, ?, ?)",
  );
  let count = 0;

  const iter = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
    owner: ref.owner,
    repo: ref.repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: 100,
    ...(since ? { since } : {}),
  });

  for await (const page of iter) {
    const issuesOnly = page.data.filter(
      (it): it is GhIssue => !("pull_request" in it && it.pull_request),
    );
    if (issuesOnly.length === 0) continue;

    const withComments = await mapWithConcurrency(
      issuesOnly,
      COMMENT_FETCH_CONCURRENCY,
      async (issue) => {
        const preview =
          issue.comments > 0 ? await fetchCommentPreview(octokit, ref, issue.number) : [];
        return { issue, preview };
      },
    );

    const tx = db.transaction((rows: typeof withComments) => {
      for (const { issue, preview } of rows) {
        const row = issueRow(issue, preview);
        const old = selectOld.get(issue.number);
        if (old) {
          deleteFts.run(issue.number, old.title, old.body, parseLabels(old.labels_json).join(" "));
        }
        insertIssue.run(...row);
        insertFts.run(issue.number, issue.title, row[2], normalizeLabels(issue.labels).join(" "));
        count += 1;
      }
    });
    tx(withComments);

    log(`[github-workflow] upserted ${count} issues so far`);
  }

  return count;
}

type IssueInsertParams = [
  number,
  string,
  string,
  string,
  string | null,
  string | null,
  string,
  string,
  string | null,
  string,
  string,
  string,
];

function authorLogin(issue: GhIssue): string | null {
  return issue.user?.login ?? null;
}

/**
 * GitHub の issue を issues テーブルの 1 行（INSERT の引数順）にする。
 *
 * @param issue - GitHub の issue
 * @param preview - コメントの抜粋
 * @returns issues テーブルの列の値
 */
function issueRow(issue: GhIssue, preview: CommentPreview[]): IssueInsertParams {
  return [
    issue.number,
    issue.title,
    issue.body ?? "",
    issue.state,
    issue.state_reason ?? null,
    authorLogin(issue),
    issue.created_at,
    issue.updated_at,
    issue.closed_at,
    issue.html_url,
    JSON.stringify(normalizeLabels(issue.labels)),
    JSON.stringify(preview),
  ];
}

async function fetchCommentPreview(
  octokit: Octokit,
  ref: RepoRef,
  number: number,
): Promise<CommentPreview[]> {
  const { data } = await octokit.rest.issues.listComments({
    owner: ref.owner,
    repo: ref.repo,
    issue_number: number,
    per_page: COMMENT_PREVIEW_COUNT,
  });
  return data.slice(0, COMMENT_PREVIEW_COUNT).map((c) => ({
    author: c.user?.login ?? "unknown",
    created_at: c.created_at,
    body: (c.body ?? "").slice(0, COMMENT_PREVIEW_CHARS),
  }));
}
