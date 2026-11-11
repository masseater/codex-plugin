#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { getOctokit } from "../../lib/octokit.ts";
import { resolveRepoRef, withIssueDb } from "../../lib/issue-db/cli.ts";
import { sync } from "../../lib/issue-db/sync.ts";

const cmd = defineCommand({
  meta: {
    name: "sync",
    description: "Sync GitHub issues for the current repository into the local SQLite cache.",
  },
  args: {
    force: {
      type: "boolean",
      description: "Force a full re-sync (ignore since-based incremental).",
    },
    host: { type: "string", description: "Override host (default: github.com or $GITHUB_HOST)." },
    owner: { type: "string", description: "Override owner (default: git remote)." },
    repo: { type: "string", description: "Override repo (default: git remote)." },
  },
  async run({ args }) {
    const ref = resolveRepoRef(args);
    await withIssueDb(ref, async (db, dbPath) => {
      const octokit = getOctokit(ref);
      const result = await sync(db, octokit, ref, { force: Boolean(args.force) });
      process.stdout.write(`${JSON.stringify({ ref, dbPath, ...result }, null, 2)}\n`);
    });
  },
});

await runMain(cmd);
