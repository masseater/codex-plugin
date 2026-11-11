#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { resolveRepoRef, withIssueDb } from "../../lib/issue-db/cli.ts";
import type { DB } from "../../lib/issue-db/db.ts";
import type { IssueRow } from "../../lib/issue-db/schema.ts";

const cmd = defineCommand({
  meta: {
    name: "show",
    description: "Show a single issue from the local cache.",
  },
  args: {
    number: { type: "positional", description: "Issue number.", required: true },
    host: { type: "string" },
    owner: { type: "string" },
    repo: { type: "string" },
  },
  async run({ args }) {
    const number = Number.parseInt(args.number, 10);
    if (!Number.isFinite(number)) {
      throw new Error(`invalid issue number: ${args.number}`);
    }
    await withIssueDb(resolveRepoRef(args), (db) => printIssue(db, number));
  },
});

/**
 * キャッシュから 1 件の issue を出力する。キャッシュに無ければ exit code 1 で終了する。
 *
 * @param db - issue DB
 * @param number - issue 番号
 */
function printIssue(db: DB, number: number): void {
  const row = db.query<IssueRow, [number]>("SELECT * FROM issues WHERE number = ?").get(number);
  if (!row) {
    process.stderr.write(`not in cache: #${number}. run sync first.\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);
}

await runMain(cmd);
