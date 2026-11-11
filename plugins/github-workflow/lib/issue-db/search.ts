import type { DB } from "./db.ts";
import { jaccard, parseLabels, recencyScore, toFtsQuery, toIssueState } from "./scoring.ts";

export type Candidate = {
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  updatedAt: string;
  labels: string[];
  bm25Norm: number;
  labelJaccard: number;
  recency: number;
  score: number;
};

type FtsRow = {
  number: number;
  title: string;
  state: string;
  url: string;
  updated_at: string;
  labels_json: string;
  rank: number;
};

const PRUNE_LIMIT = 200;
const BM25_WEIGHT = 0.7;
const LABEL_WEIGHT = 0.2;
const RECENCY_WEIGHT = 0.1;

const FTS_QUERY_ANY_STATE = `
SELECT i.number, i.title, i.state, i.url, i.updated_at, i.labels_json,
       bm25(issues_fts) AS rank
  FROM issues_fts
  JOIN issues i ON i.number = issues_fts.rowid
 WHERE issues_fts MATCH ?
 ORDER BY rank
 LIMIT ${PRUNE_LIMIT}`;

const FTS_QUERY_OPEN_ONLY = `
SELECT i.number, i.title, i.state, i.url, i.updated_at, i.labels_json,
       bm25(issues_fts) AS rank
  FROM issues_fts
  JOIN issues i ON i.number = issues_fts.rowid
 WHERE issues_fts MATCH ?
   AND i.state = 'open'
 ORDER BY rank
 LIMIT ${PRUNE_LIMIT}`;

export type SearchOptions = {
  limit?: number;
  includeClosed?: boolean;
  queryLabels?: readonly string[];
};

type ScoreContext = {
  minRank: number;
  rankRange: number;
  queryLabelSet: Set<string>;
  now: number;
};

function ftsQuerySql(includeClosed: boolean | undefined): string {
  return includeClosed === false ? FTS_QUERY_OPEN_ONLY : FTS_QUERY_ANY_STATE;
}

/**
 * 候補全体に共通する、スコア計算の基準値を求める。
 *
 * @param rows - FTS の検索結果
 * @param queryLabels - 検索クエリに付けるラベル
 * @returns bm25 の正規化範囲・クエリのラベル集合・現在時刻
 */
function scoreContext(rows: FtsRow[], queryLabels: readonly string[] = []): ScoreContext {
  const ranks = rows.map((r) => r.rank);
  const minRank = Math.min(...ranks);
  return {
    minRank,
    rankRange: Math.max(...ranks) - minRank || 1,
    queryLabelSet: new Set(queryLabels.map((l) => l.toLowerCase())),
    now: Date.now(),
  };
}

/**
 * FTS の 1 行を、bm25・ラベル一致・新しさを合成したスコア付きの候補にする。
 *
 * @param r - FTS の検索結果の 1 行
 * @param ctx - スコア計算の基準値
 * @returns 候補。state が open / closed 以外なら null
 */
function toCandidate(r: FtsRow, ctx: ScoreContext): Candidate | null {
  const state = toIssueState(r.state);
  if (!state) return null;
  // FTS5 bm25: lower = better; normalize so higher-better in [0,1]
  const bm25Norm = 1 - (r.rank - ctx.minRank) / ctx.rankRange;
  const labels = parseLabels(r.labels_json);
  const labelJaccard = jaccard(new Set(labels.map((l) => l.toLowerCase())), ctx.queryLabelSet);
  const recency = recencyScore(r.updated_at, ctx.now);
  const score = BM25_WEIGHT * bm25Norm + LABEL_WEIGHT * labelJaccard + RECENCY_WEIGHT * recency;
  return {
    number: r.number,
    title: r.title,
    state,
    url: r.url,
    updatedAt: r.updated_at,
    labels,
    bm25Norm,
    labelJaccard,
    recency,
    score,
  };
}

export function search(db: DB, query: string, opts: SearchOptions = {}): Candidate[] {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];

  const rows = db.query<FtsRow, [string]>(ftsQuerySql(opts.includeClosed)).all(ftsQuery);
  const ctx = scoreContext(rows, opts.queryLabels);
  return rows
    .map((r) => toCandidate(r, ctx))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 10);
}
