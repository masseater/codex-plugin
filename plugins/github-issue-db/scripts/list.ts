#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { openDb } from "../lib/db.ts";
import { dbPathFor, resolveRepoFromGit } from "../lib/repo.ts";
import type { IssueRow } from "../lib/schema.ts";

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
  run({ args }) {
    const ref =
      args.owner && args.repo
        ? { host: args.host || "github.com", owner: args.owner, repo: args.repo }
        : resolveRepoFromGit();
    const dbPath = dbPathFor(ref);
    const db = openDb(dbPath);
    try {
      const limit = Number.parseInt(args.limit, 10);
      const rows = queryIssues(db, {
        label: args.label,
        updatedSince: args["updated-since"],
        authoredBy: args["authored-by"],
        numbers: args.numbers,
        state: args.state,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      process.stdout.write(`${JSON.stringify({ ref, count: rows.length, rows }, null, 2)}\n`);
    } finally {
      db.close();
    }
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

function queryIssues(db: ReturnType<typeof openDb>, opts: QueryOpts): ListRow[] {
  if (opts.numbers) {
    const numbers = opts.numbers
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter(Number.isFinite);
    if (numbers.length === 0) return [];
    const placeholders = numbers.map(() => "?").join(",");
    return db
      .query<ListRow, number[]>(
        `SELECT number, title, state, author, created_at, updated_at, url, labels_json
           FROM issues
          WHERE number IN (${placeholders})
          ORDER BY updated_at DESC`,
      )
      .all(...numbers);
  }

  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts.state !== "all") {
    clauses.push("state = ?");
    params.push(opts.state);
  }
  if (opts.updatedSince) {
    clauses.push("updated_at >= ?");
    params.push(opts.updatedSince);
  }
  if (opts.authoredBy) {
    clauses.push("author = ?");
    params.push(opts.authoredBy);
  }
  if (opts.label) {
    // labels_json is a JSON array of strings. Split on comma for AND semantics.
    for (const raw of opts.label
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean)) {
      clauses.push(`labels_json LIKE ?`);
      // Match `"label"` as a substring so it won't collide with partial names.
      params.push(`%${JSON.stringify(raw)}%`);
    }
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT number, title, state, author, created_at, updated_at, url, labels_json
                 FROM issues
                 ${where}
                 ORDER BY updated_at DESC
                 LIMIT ?`;
  params.push(opts.limit);
  return db.query<ListRow, (string | number)[]>(sql).all(...params);
}

await runMain(cmd);
