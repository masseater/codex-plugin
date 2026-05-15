#!/usr/bin/env bun
/**
 * Apply a status update to a GitHub issue: post a review comment, add/remove
 * labels, and/or close/reopen the issue. Runs only the changes that are
 * explicitly requested via flags.
 */

import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { getEnv } from "../env.ts";
import { parseIssueRef } from "../lib/repo-info.ts";

/** An open/closed state change to apply to an issue, or null for no change. */
export type StateChange = {
  state: "open" | "closed";
  stateReason: "completed" | "not_planned" | null;
} | null;

/**
 * Split a comma-separated label list into trimmed, non-empty label names.
 *
 * @param csv - A comma-separated label string, or undefined.
 * @returns The parsed label names with blanks removed.
 */
export function parseLabelList(csv: string | undefined): string[] {
  if (!csv) {
    return [];
  }
  return csv
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Resolve the open/closed state change requested by the flags.
 *
 * @param opts - The close / reopen / state-reason flags from the CLI.
 * @returns The state change to apply, or null when neither close nor reopen was requested.
 */
export function resolveStateChange(opts: {
  close?: boolean | undefined;
  reopen?: boolean | undefined;
  stateReason?: string | undefined;
}): StateChange {
  if (opts.close && opts.reopen) {
    throw new Error("Cannot use --close and --reopen together");
  }
  if (opts.close) {
    const reason = opts.stateReason ?? "completed";
    if (reason !== "completed" && reason !== "not_planned") {
      throw new Error(`Invalid --state-reason: "${reason}". Use "completed" or "not_planned".`);
    }
    return { state: "closed", stateReason: reason };
  }
  if (opts.reopen) {
    return { state: "open", stateReason: null };
  }
  return null;
}

type UpdateResult = {
  owner: string;
  repo: string;
  number: number;
  url: string;
  applied: string[];
  state: string;
  labels: string[];
  commentUrl: string | null;
};

type UpdateArgs = {
  issue: string;
  comment?: string;
  "add-label"?: string;
  "remove-label"?: string;
  close?: boolean;
  reopen?: boolean;
  "state-reason"?: string;
};

async function updateIssueStatus(args: UpdateArgs): Promise<UpdateResult> {
  const ref = await parseIssueRef(args.issue);
  const addLabels = parseLabelList(args["add-label"]);
  const removeLabels = parseLabelList(args["remove-label"]);
  const stateChange = resolveStateChange({
    close: args.close,
    reopen: args.reopen,
    stateReason: args["state-reason"],
  });

  if (!args.comment && addLabels.length === 0 && removeLabels.length === 0 && !stateChange) {
    throw new Error(
      "No changes requested. Pass --comment, --add-label, --remove-label, --close, or --reopen.",
    );
  }

  const octokit = new Octokit({ auth: getEnv().GITHUB_TOKEN });
  const target = { owner: ref.owner, repo: ref.repo, issue_number: ref.issueNumber };
  const applied: string[] = [];
  let commentUrl: string | null = null;

  if (args.comment) {
    const { data } = await octokit.rest.issues.createComment({
      ...target,
      body: args.comment,
    });
    commentUrl = data.html_url;
    applied.push("posted review comment");
  }

  if (addLabels.length > 0) {
    await octokit.rest.issues.addLabels({ ...target, labels: addLabels });
    applied.push(`added labels: ${addLabels.join(", ")}`);
  }

  if (removeLabels.length > 0) {
    const removals = await Promise.all(
      removeLabels.map(async (label) => {
        try {
          await octokit.rest.issues.removeLabel({ ...target, name: label });
          return `removed label: ${label}`;
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status === 404) {
            return `label not present, skipped: ${label}`;
          }
          throw error;
        }
      }),
    );
    applied.push(...removals);
  }

  if (stateChange) {
    await octokit.rest.issues.update({
      ...target,
      state: stateChange.state,
      ...(stateChange.stateReason ? { state_reason: stateChange.stateReason } : {}),
    });
    applied.push(
      stateChange.state === "closed" ? `closed (${stateChange.stateReason})` : "reopened",
    );
  }

  const { data: issue } = await octokit.rest.issues.get(target);

  return {
    owner: ref.owner,
    repo: ref.repo,
    number: issue.number,
    url: issue.html_url,
    applied,
    state: issue.state,
    labels: issue.labels
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter((name) => name.length > 0),
    commentUrl,
  };
}

const main = defineCommand({
  meta: {
    name: "update-issue-status",
    description: "GitHub Issue にレビューコメント投稿・ラベル変更・open/close を適用",
  },
  args: {
    issue: {
      type: "positional",
      description: "Issue 番号（例: 42）または GitHub Issue URL",
      required: true,
    },
    comment: {
      type: "string",
      description: "投稿するレビューコメント本文",
    },
    "add-label": {
      type: "string",
      description: "付与するラベル（カンマ区切り）",
    },
    "remove-label": {
      type: "string",
      description: "外すラベル（カンマ区切り、未付与のものはスキップ）",
    },
    close: {
      type: "boolean",
      description: "Issue をクローズする",
    },
    reopen: {
      type: "boolean",
      description: "Issue を再オープンする",
    },
    "state-reason": {
      type: "string",
      description: "クローズ理由: completed（既定）または not_planned",
    },
  },
  async run({ args }) {
    const result = await updateIssueStatus(args as UpdateArgs);
    console.log(JSON.stringify(result, null, 2));
  },
});

if (import.meta.main) {
  runMain(main);
}
