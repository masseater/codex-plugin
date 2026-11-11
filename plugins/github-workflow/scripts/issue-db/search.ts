#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { parseLimit, resolveRepoRef, withIssueDb } from "../../lib/issue-db/cli.ts";
import { search } from "../../lib/issue-db/search.ts";

const cmd = defineCommand({
  meta: {
    name: "search",
    description:
      "Search locally-cached GitHub issues via FTS5 BM25 + label Jaccard + recency boost (no ML model).",
  },
  args: {
    query: { type: "positional", description: "Free-form query string.", required: true },
    limit: { type: "string", description: "Max candidates (default 10).", default: "10" },
    openOnly: { type: "boolean", description: "Exclude closed issues from results." },
    host: { type: "string" },
    owner: { type: "string" },
    repo: { type: "string" },
  },
  async run({ args }) {
    const ref = resolveRepoRef(args);
    await withIssueDb(ref, (db) => {
      const candidates = search(db, args.query, {
        limit: parseLimit(args.limit, 10),
        includeClosed: !args.openOnly,
      });
      process.stdout.write(`${JSON.stringify({ ref, query: args.query, candidates }, null, 2)}\n`);
    });
  },
});

await runMain(cmd);
