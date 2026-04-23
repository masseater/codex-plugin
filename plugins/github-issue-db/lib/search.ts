import type { DB } from "./db.ts";

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

export function search(db: DB, query: string, opts: SearchOptions = {}): Candidate[] {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];

  const sql = opts.includeClosed === false ? FTS_QUERY_OPEN_ONLY : FTS_QUERY_ANY_STATE;
  const rows = db.query<FtsRow, [string]>(sql).all(ftsQuery);
  if (rows.length === 0) return [];

  const ranks = rows.map((r) => r.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const range = maxRank - minRank || 1;

  const queryLabelSet = new Set((opts.queryLabels ?? []).map((l) => l.toLowerCase()));
  const now = Date.now();

  const candidates: Candidate[] = [];
  for (const r of rows) {
    const state = toIssueState(r.state);
    if (!state) continue;
    // FTS5 bm25: lower = better; normalize so higher-better in [0,1]
    const bm25Norm = 1 - (r.rank - minRank) / range;
    const labels = parseLabels(r.labels_json);
    const labelJaccard = jaccard(new Set(labels.map((l) => l.toLowerCase())), queryLabelSet);
    const recency = recencyScore(r.updated_at, now);
    const score = BM25_WEIGHT * bm25Norm + LABEL_WEIGHT * labelJaccard + RECENCY_WEIGHT * recency;
    candidates.push({
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
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const limit = opts.limit ?? 10;
  return candidates.slice(0, limit);
}

export function toIssueState(raw: string): "open" | "closed" | null {
  return raw === "open" || raw === "closed" ? raw : null;
}

export function parseLabels(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function recencyScore(updatedAt: string, now: number): number {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (now - t) / 86_400_000);
  // Smooth decay: 1.0 today, ~0.5 at 1 year, asymptotes toward 0
  return 1 / (1 + days / 365);
}

/**
 * Build an FTS5 MATCH query from a raw user string. Returns empty string when
 * the sanitized text has no useful tokens for trigram indexing.
 *
 * Strategy:
 * - Strip FTS5 operators that would otherwise be interpreted (`" ( ) * :`)
 * - If the sanitized text has whitespace-separated words of ≥3 chars,
 *   emit them as an OR of quoted phrases (each phrase is trigram-matched)
 * - If no such words exist (e.g. a single short non-whitespaced block like a
 *   Japanese phrase), fall back to treating the whole sanitized text as one
 *   phrase — trigram still gives recall on 3+ Unicode code points
 * - If the full sanitized text is also under 3 chars, return empty — FTS5
 *   trigram cannot index it
 */
export function toFtsQuery(raw: string): string {
  const sanitized = raw
    .normalize("NFKC")
    .replace(/["()*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length < 3) return "";

  const phrases = sanitized
    .split(" ")
    .filter((t) => t.length >= 3)
    .map((t) => `"${t}"`);
  if (phrases.length > 0) return phrases.join(" OR ");

  // No ≥3-char words after splitting on whitespace. The whole block itself
  // is ≥3 chars (guard above), so wrap it as a single phrase.
  return `"${sanitized}"`;
}
