import type { DB } from "../lib/issue-db/db.ts";
import type { IssueRow } from "../lib/issue-db/schema.ts";

/**
 * テスト用に issue を issues テーブルと FTS の両方へ入れる。
 *
 * @param db - issue DB
 * @param overrides - 既定値を上書きする列
 * @returns 入れた行
 */
export function insertIssue(db: DB, overrides: Partial<IssueRow> & { number: number }): IssueRow {
  const row: IssueRow = {
    title: `issue ${overrides.number}`,
    body: "",
    state: "open",
    state_reason: null,
    author: "alice",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    url: `https://example.test/${overrides.number}`,
    labels_json: "[]",
    comments_json: "[]",
    ...overrides,
  };
  db.run(
    `INSERT INTO issues (number, title, body, state, state_reason, author, created_at, updated_at, closed_at, url, labels_json, comments_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.number,
      row.title,
      row.body,
      row.state,
      row.state_reason,
      row.author,
      row.created_at,
      row.updated_at,
      row.closed_at,
      row.url,
      row.labels_json,
      row.comments_json,
    ],
  );
  db.run("INSERT INTO issues_fts (rowid, title, body, labels) VALUES (?, ?, ?, ?)", [
    row.number,
    row.title,
    row.body,
    row.labels_json,
  ]);
  return row;
}
