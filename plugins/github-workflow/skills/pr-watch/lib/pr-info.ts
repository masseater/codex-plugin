#!/usr/bin/env bun
/**
 * 現在のブランチに紐づくPR情報を取得する共有ユーティリティ
 */

import { Octokit } from "octokit";
import { simpleGit } from "simple-git";
import { resolveOriginRepo } from "../../../lib/git-origin.ts";
import { env } from "../env.js";

export type PRInfo = {
  owner: string;
  repo: string;
  pr: number;
  headSha: string;
};

export async function getCurrentPRInfo(): Promise<PRInfo> {
  const git = simpleGit();
  const { owner, repo } = await resolveOriginRepo(git);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch.trim()}`,
    state: "open",
  });

  const firstPr = prs[0];
  if (!firstPr) {
    throw new Error(`No open PR found for branch: ${branch.trim()}`);
  }

  return {
    owner,
    repo,
    pr: firstPr.number,
    headSha: firstPr.head.sha,
  };
}
