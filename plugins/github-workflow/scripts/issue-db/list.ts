#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { parseLimit, resolveRepoRef, withIssueDb } from "../../lib/issue-db/cli.ts";
import type { DB } from "../../lib/issue-db/db.ts";
import type { IssueRow } from "../../lib/issue-db/schema.ts";

type ListRow = Pick<
  IssueRow,
  "number" | "title" | "state" | "author" | "created_at" | "updated_at" | "url" | "labels_json"
>;

const cmd = defineCommand({
  meta: {
    name: "list",
    description:
      "List cached GitHub issues with selector-based filters (label / updated-since / authored-by / numbers / state).",
  },
  args: {
    label: {
      type: "string",
      description: "Match issues containing this label. Repeatable via comma (AND semantics).",
    },
    "updated-since": {
      type: "string",
      description: "ISO8601 timestamp. Only return issues with updated_at >= this.",
    },
    "authored-by": { type: "string", description: "GitHub username of the issue author." },
    numbers: {
      type: "string",
      description: "Comma-separated issue numbers (e.g. 42,57). Other filters are ignored.",
    },
    state: {
      type: "string",
      description: "Filter by state: open | closed | all.",
      default: "open",
    },
    limit: { type: "string", description: "Max rows to return.", default: "50" },
    host: { type: "string" },
    owner: { type: "string" },
    repo: { type: "string" },
  },
  async run({ args }) {
    const ref = resolveRepoRef(args);
    await withIssueDb(ref, (db) => {
      const rows = queryIssues(db, {
        label: args.label,
        updatedSince: args["updated-since"],
        authoredBy: args["authored-by"],
        numbers: args.numbers,
        state: args.state,
        limit: parseLimit(args.limit, 50),
      });
      process.stdout.write(`${JSON.stringify({ ref, count: rows.length, rows }, null, 2)}\n`);
    });
  },
});

type QueryOpts = {
  label?: string | undefined;
  updatedSince?: string | undefined;
  authoredBy?: string | undefined;
  numbers?: string | undefined;
  state: string;
  limit: number;
};

const LIST_COLUMNS = "number, title, state, author, created_at, updated_at, url, labels_json";

// 条件はすべて固定の式で書き、値はプレースホルダで渡す。未指定の条件は NULL を渡して無効にする。
// ラベルは JSON 配列で渡し、labels_json がすべてのラベルを `"label"` の形で含むものだけを残す（AND）
const LIST_SQL = `SELECT ${LIST_COLUMNS}
  FROM issues
 WHERE (?1 = 'all' OR state = ?1)
   AND (?2 IS NULL OR updated_at >= ?2)
   AND (?3 IS NULL OR author = ?3)
   AND NOT EXISTS (
     SELECT 1 FROM json_each(?4) AS wanted
      WHERE issues.labels_json NOT LIKE '%' || json_quote(wanted.value) || '%'
   )
 ORDER BY updated_at DESC
 LIMIT ?5`;

const NUMBERS_SQL = `SELECT ${LIST_COLUMNS}
  FROM issues
 WHERE number IN (SELECT value FROM json_each(?1))
 ORDER BY updated_at DESC`;

/**
 * カンマ区切りのラベル指定を、空要素を除いたラベル名の一覧にする。
 *
 * @param label - CLI の --label 引数
 * @returns ラベル名の一覧
 */
function splitLabels(label: string | undefined): string[] {
  return (label ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * カンマ区切りの issue 番号で issue を取得する。
 *
 * @param db - issue DB
 * @param rawNumbers - CLI の --numbers 引数
 * @returns 指定した番号の issue（更新が新しい順）
 */
function queryByNumbers(db: DB, rawNumbers: string): ListRow[] {
  const numbers = rawNumbers
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter(Number.isFinite);
  if (numbers.length === 0) return [];
  return db.query<ListRow, [string]>(NUMBERS_SQL).all(JSON.stringify(numbers));
}

function queryIssues(db: DB, opts: QueryOpts): ListRow[] {
  if (opts.numbers) return queryByNumbers(db, opts.numbers);
  return db
    .query<ListRow, [string, string | null, string | null, string, number]>(LIST_SQL)
    .all(
      opts.state,
      opts.updatedSince ?? null,
      opts.authoredBy ?? null,
      JSON.stringify(splitLabels(opts.label)),
      opts.limit,
    );
}

await runMain(cmd);
