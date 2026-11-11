import type { Octokit } from "octokit";
import { getMeta, setMeta, type DB } from "./db.ts";
import type { CommentPreview } from "./schema.ts";
import type { RepoRef } from "./repo.ts";

const COMMENT_PREVIEW_COUNT = 3;
const COMMENT_PREVIEW_CHARS = 400;
const FORCE_FULL_DIFF_RATIO = 0.05;
const COMMENT_FETCH_CONCURRENCY = 10;

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      results[i] = await task(item, i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function sinceWithSkew(iso: string, skewMs = 60_000): string {
  const ms = new Date(iso).getTime();
  return new Date(ms - skewMs).toISOString();
}

export function shouldForceFull(
  currentTotal: number,
  lastTotal: number,
  forced: boolean,
  lastSync: string | undefined,
): boolean {
  if (forced) return true;
  if (!lastSync) return true;
  if (lastTotal <= 0) return false;
  return Math.abs(currentTotal - lastTotal) / Math.max(lastTotal, 1) > FORCE_FULL_DIFF_RATIO;
}

type LabelLike = { name?: string | null } | string | null | undefined;

export function normalizeLabels(labels: readonly LabelLike[]): string[] {
  const out: string[] = [];
  for (const l of labels) {
    if (!l) continue;
    if (typeof l === "string") out.push(l);
    else if (typeof l.name === "string") out.push(l.name);
  }
  return out;
}

type GhIssue = Awaited<ReturnType<Octokit["rest"]["issues"]["listForRepo"]>>["data"][number];

export type SyncResult = {
  mode: "full" | "incremental";
  upserted: number;
  totalAfterSync: number;
};

export async function sync(
  db: DB,
  octokit: Octokit,
  ref: RepoRef,
  opts: { force?: boolean; log?: (msg: string) => void } = {},
): Promise<SyncResult> {
  const log = opts.log ?? ((msg) => process.stderr.write(`${msg}\n`));
  const lastSync = getMeta(db, "last_sync");
  const lastTotalRaw = getMeta(db, "total_at_last_sync");
  const lastTotal = lastTotalRaw ? Number.parseInt(lastTotalRaw, 10) : 0;

  const currentTotal = await fetchIssueCount(octokit, ref);
  const mustFull = shouldForceFull(currentTotal, lastTotal, Boolean(opts.force), lastSync);

  const mode = mustFull ? "full" : "incremental";
  log(
    `[github-issue-db] ${mode} sync for ${ref.owner}/${ref.repo} (current total=${currentTotal})`,
  );

  const sinceIso = !mustFull && lastSync ? sinceWithSkew(lastSync) : undefined;
  const upserted = await paginateAndUpsert(db, octokit, ref, sinceIso, log);

  const nowIso = new Date().toISOString();
  setMeta(db, "last_sync", nowIso);
  if (mustFull) setMeta(db, "last_full_sync", nowIso);
  setMeta(db, "total_at_last_sync", String(currentTotal));

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
  const insertIssue = db.prepare<
    unknown,
    [
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
    ]
  >(
    `INSERT OR REPLACE INTO issues
      (number, title, body, state, state_reason, author, created_at, updated_at, closed_at, url, labels_json, comments_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const deleteFts = db.prepare<unknown, [number]>(
    "INSERT INTO issues_fts(issues_fts, rowid, title, body, labels) VALUES('delete', ?, '', '', '')",
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
        const body = issue.body ?? "";
        const labelsJson = JSON.stringify(normalizeLabels(issue.labels));
        const commentsJson = JSON.stringify(preview);
        insertIssue.run(
          issue.number,
          issue.title,
          body,
          issue.state as string,
          issue.state_reason ?? null,
          issue.user?.login ?? null,
          issue.created_at,
          issue.updated_at,
          issue.closed_at,
          issue.html_url,
          labelsJson,
          commentsJson,
        );
        deleteFts.run(issue.number);
        insertFts.run(issue.number, issue.title, body, normalizeLabels(issue.labels).join(" "));
        count += 1;
      }
    });
    tx(withComments);

    log(`[github-issue-db] upserted ${count} issues so far`);
  }

  return count;
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
