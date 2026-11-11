export const SCHEMA_VERSION = 2;

export const DDL = `
CREATE TABLE IF NOT EXISTS issues (
  number      INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL,
  state_reason TEXT,
  author      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  closed_at   TEXT,
  url         TEXT NOT NULL,
  labels_json TEXT NOT NULL DEFAULT '[]',
  comments_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at);
CREATE INDEX IF NOT EXISTS idx_issues_author ON issues(author);

CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
  title,
  body,
  labels,
  content='',
  tokenize='trigram'
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export type IssueRow = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  state_reason: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  url: string;
  labels_json: string;
  comments_json: string;
};

export type CommentPreview = {
  author: string;
  created_at: string;
  body: string;
};
