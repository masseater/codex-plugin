#!/usr/bin/env bun
/**
 * 現在のブランチに紐づくPR情報を取得する共有ユーティリティ
 */

import { Octokit } from "octokit";
import type { RemoteWithRefs } from "simple-git";
import { simpleGit } from "simple-git";
import { env } from "../env.js";

export type PRInfo = {
  owner: string;
  repo: string;
  pr: number;
  headSha: string;
};

export async function getCurrentPRInfo(): Promise<PRInfo> {
  const git = simpleGit();

  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r: RemoteWithRefs) => r.name === "origin");
  if (!origin?.refs.fetch) {
    throw new Error("No origin remote found");
  }

  const match = origin.refs.fetch.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (!match) {
    throw new Error("Could not parse GitHub URL from origin");
  }

  const matchedOwner = match[1];
  const matchedRepo = match[2];
  if (!matchedOwner || !matchedRepo) {
    throw new Error("Could not extract owner/repo from origin");
  }

  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
  const repoName = matchedRepo.replace(/\.git$/, "");

  const { data: prs } = await octokit.rest.pulls.list({
    owner: matchedOwner,
    repo: repoName,
    head: `${matchedOwner}:${branch.trim()}`,
    state: "open",
  });

  const firstPr = prs[0];
  if (!firstPr) {
    throw new Error(`No open PR found for branch: ${branch.trim()}`);
  }

  return {
    owner: matchedOwner,
    repo: repoName,
    pr: firstPr.number,
    headSha: firstPr.head.sha,
  };
}
