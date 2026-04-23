#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { openDb } from "../lib/db.ts";
import { dbPathFor, resolveRepoFromGit } from "../lib/repo.ts";
import type { IssueRow } from "../lib/schema.ts";

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
  run({ args }) {
    const ref =
      args.owner && args.repo
        ? { host: args.host || "github.com", owner: args.owner, repo: args.repo }
        : resolveRepoFromGit();
    const dbPath = dbPathFor(ref);
    const db = openDb(dbPath);
    try {
      const number = Number.parseInt(args.number, 10);
      if (!Number.isFinite(number)) {
        throw new Error(`invalid issue number: ${args.number}`);
      }
      const row = db.query<IssueRow, [number]>("SELECT * FROM issues WHERE number = ?").get(number);
      if (!row) {
        process.stderr.write(`not in cache: #${number}. run sync first.\n`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);
    } finally {
      db.close();
    }
  },
});

await runMain(cmd);
