#!/usr/bin/env bun
/**
 * Fetch a GitHub issue's body, comments, labels, state, and assignees as JSON.
 * The output feeds the issue-status-review skill's completion review step.
 */

import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { getEnv } from "../env.ts";
import { type IssueRef, parseIssueRef } from "../lib/repo-info.ts";

type RawIssue = {
  number: number;
  title: string;
  state: string;
  state_reason?: string | null;
  labels: Array<string | { name?: string | null }>;
  assignees?: Array<{ login: string }> | null;
  milestone?: { title: string } | null;
  user?: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  body?: string | null;
};

type RawComment = {
  user?: { login: string } | null;
  created_at: string;
  updated_at: string;
  body?: string | null;
  html_url: string;
};

type IssueComment = {
  author: string;
  createdAt: string;
  updatedAt: string;
  body: string;
  url: string;
};

type IssueResult = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: string;
  stateReason: string | null;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  body: string;
  comments: IssueComment[];
};

/**
 * Normalize raw GitHub API issue + comments data into the flat review shape.
 *
 * @param ref - The issue reference the data was fetched for.
 * @param issue - The raw issue payload from the GitHub API.
 * @param comments - The raw issue comment payloads from the GitHub API.
 * @returns The flattened issue result consumed by the review step.
 */
export function toIssueResult(ref: IssueRef, issue: RawIssue, comments: RawComment[]): IssueResult {
  return {
    owner: ref.owner,
    repo: ref.repo,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
    labels: issue.labels
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter((name) => name.length > 0),
    assignees: (issue.assignees ?? []).map((a) => a.login),
    milestone: issue.milestone?.title ?? null,
    author: issue.user?.login ?? "",
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    body: issue.body ?? "",
    comments: comments.map((c) => ({
      author: c.user?.login ?? "",
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      body: c.body ?? "",
      url: c.html_url,
    })),
  };
}

async function fetchIssue(input: string): Promise<IssueResult> {
  const ref = await parseIssueRef(input);
  const octokit = new Octokit({ auth: getEnv().GITHUB_TOKEN });

  const { data: issue } = await octokit.rest.issues.get({
    owner: ref.owner,
    repo: ref.repo,
    issue_number: ref.issueNumber,
  });

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: ref.owner,
    repo: ref.repo,
    issue_number: ref.issueNumber,
    per_page: 100,
  });

  return toIssueResult(ref, issue, comments);
}

const main = defineCommand({
  meta: {
    name: "fetch-issue",
    description: "GitHub Issue の body・コメント・ラベル・状態を JSON で取得",
  },
  args: {
    issue: {
      type: "positional",
      description: "Issue 番号（例: 42）または GitHub Issue URL",
      required: true,
    },
  },
  async run({ args }) {
    const result = await fetchIssue(args.issue);
    console.log(JSON.stringify(result, null, 2));
  },
});

if (import.meta.main) {
  runMain(main);
}
