#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { openDb } from "../lib/db.ts";
import { dbPathFor, resolveRepoFromGit } from "../lib/repo.ts";
import { search } from "../lib/search.ts";

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
  run({ args }) {
    const ref =
      args.owner && args.repo
        ? { host: args.host || "github.com", owner: args.owner, repo: args.repo }
        : resolveRepoFromGit();
    const dbPath = dbPathFor(ref);
    const db = openDb(dbPath);
    try {
      const limit = Number.parseInt(args.limit, 10);
      const candidates = search(db, args.query, {
        limit: Number.isFinite(limit) ? limit : 10,
        includeClosed: !args.openOnly,
      });
      process.stdout.write(`${JSON.stringify({ ref, query: args.query, candidates }, null, 2)}\n`);
    } finally {
      db.close();
    }
  },
});

await runMain(cmd);
