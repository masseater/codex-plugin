#!/usr/bin/env bun
/**
 * Apply a status update to a GitHub issue: post a review comment, add/remove
 * labels, and/or close/reopen the issue. Runs only the changes that are
 * explicitly requested via flags.
 */

import { readFileSync } from "node:fs";
import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { resolveGithubToken } from "../../../lib/octokit.ts";
import { parseIssueRef } from "../lib/issue-ref.ts";

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

function isCloseReason(reason: string): reason is "completed" | "not_planned" {
  return reason === "completed" || reason === "not_planned";
}

/**
 * Build the change that closes an issue with the given reason.
 *
 * @param rawReason - The --state-reason flag, defaulting to "completed".
 * @returns The close state change.
 */
function closeChange(rawReason: string | undefined): NonNullable<StateChange> {
  const reason = rawReason ?? "completed";
  if (!isCloseReason(reason)) {
    throw new Error(`Invalid --state-reason: "${reason}". Use "completed" or "not_planned".`);
  }
  return { state: "closed", stateReason: reason };
}

function reopenChange(reopen: boolean | undefined): StateChange {
  return reopen ? { state: "open", stateReason: null } : null;
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
  if (opts.close) return closeChange(opts.stateReason);
  return reopenChange(opts.reopen);
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
  comment?: string | undefined;
  "comment-file"?: string | undefined;
  "add-label"?: string | undefined;
  "remove-label"?: string | undefined;
  close?: boolean | undefined;
  reopen?: boolean | undefined;
  "state-reason"?: string | undefined;
};

/** The changes requested by the CLI flags. */
type PlannedUpdate = {
  comment: string | undefined;
  addLabels: string[];
  removeLabels: string[];
  stateChange: StateChange;
};

type IssueTarget = { owner: string; repo: string; issue_number: number };

/**
 * Resolve the comment body from `--comment` or `--comment-file` (mutually exclusive).
 *
 * @param opts - The comment flags from the CLI.
 * @param readFile - Reads a file as UTF-8 (injectable for tests).
 * @returns The comment body, or undefined when no comment was requested.
 */
export function resolveCommentBody(
  opts: { comment?: string | undefined; commentFile?: string | undefined },
  readFile: (path: string) => string = (path) => readFileSync(path, "utf-8"),
): string | undefined {
  if (opts.comment && opts.commentFile) {
    throw new Error("Cannot use --comment and --comment-file together");
  }
  if (opts.commentFile) {
    return readFile(opts.commentFile);
  }
  return opts.comment;
}

function hasChanges(plan: PlannedUpdate): boolean {
  return (
    Boolean(plan.comment) ||
    plan.addLabels.length > 0 ||
    plan.removeLabels.length > 0 ||
    plan.stateChange !== null
  );
}

/**
 * Read the requested changes from the CLI flags.
 *
 * @param args - The CLI flags.
 * @returns The requested changes.
 * @throws Error when no change is requested.
 */
function planUpdate(args: UpdateArgs): PlannedUpdate {
  const plan: PlannedUpdate = {
    comment: resolveCommentBody({ comment: args.comment, commentFile: args["comment-file"] }),
    addLabels: parseLabelList(args["add-label"]),
    removeLabels: parseLabelList(args["remove-label"]),
    stateChange: resolveStateChange({
      close: args.close,
      reopen: args.reopen,
      stateReason: args["state-reason"],
    }),
  };
  if (!hasChanges(plan)) {
    throw new Error(
      "No changes requested. Pass --comment, --comment-file, --add-label, --remove-label, --close, or --reopen.",
    );
  }
  return plan;
}

async function postComment(
  octokit: Octokit,
  target: IssueTarget,
  comment: string | undefined,
): Promise<{ applied: string[]; commentUrl: string | null }> {
  if (!comment) return { applied: [], commentUrl: null };
  const { data } = await octokit.rest.issues.createComment({ ...target, body: comment });
  return { applied: ["posted review comment"], commentUrl: data.html_url };
}

async function addLabels(
  octokit: Octokit,
  target: IssueTarget,
  labels: string[],
): Promise<string[]> {
  if (labels.length === 0) return [];
  await octokit.rest.issues.addLabels({ ...target, labels });
  return [`added labels: ${labels.join(", ")}`];
}

function httpStatusOf(error: unknown): unknown {
  return typeof error === "object" && error !== null && "status" in error
    ? error.status
    : undefined;
}

/**
 * Remove one label. A label that is not on the issue (404) is reported as skipped.
 *
 * @param octokit - The GitHub client.
 * @param target - The issue to update.
 * @param label - The label to remove.
 * @returns A description of what was done.
 */
async function removeLabel(octokit: Octokit, target: IssueTarget, label: string): Promise<string> {
  try {
    await octokit.rest.issues.removeLabel({ ...target, name: label });
    return `removed label: ${label}`;
  } catch (error) {
    if (httpStatusOf(error) === 404) {
      return `label not present, skipped: ${label}`;
    }
    throw error;
  }
}

async function applyStateChange(
  octokit: Octokit,
  target: IssueTarget,
  stateChange: StateChange,
): Promise<string[]> {
  if (!stateChange) return [];
  await octokit.rest.issues.update({
    ...target,
    state: stateChange.state,
    ...(stateChange.stateReason ? { state_reason: stateChange.stateReason } : {}),
  });
  return [stateChange.state === "closed" ? `closed (${stateChange.stateReason})` : "reopened"];
}

function labelNames(labels: ReadonlyArray<string | { name?: string | undefined }>): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
    .filter((name) => name.length > 0);
}

async function updateIssueStatus(args: UpdateArgs): Promise<UpdateResult> {
  const ref = await parseIssueRef(args.issue);
  const plan = planUpdate(args);

  const octokit = new Octokit({ auth: resolveGithubToken() });
  const target = { owner: ref.owner, repo: ref.repo, issue_number: ref.issueNumber };

  const commented = await postComment(octokit, target, plan.comment);
  const added = await addLabels(octokit, target, plan.addLabels);
  const removed = await Promise.all(
    plan.removeLabels.map((label) => removeLabel(octokit, target, label)),
  );
  const stateChanged = await applyStateChange(octokit, target, plan.stateChange);

  const { data: issue } = await octokit.rest.issues.get(target);

  return {
    owner: ref.owner,
    repo: ref.repo,
    number: issue.number,
    url: issue.html_url,
    applied: [...commented.applied, ...added, ...removed, ...stateChanged],
    state: issue.state,
    labels: labelNames(issue.labels),
    commentUrl: commented.commentUrl,
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
    "comment-file": {
      type: "string",
      description: "投稿するレビューコメント本文を読むファイル（--comment と排他）",
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
    const result = await updateIssueStatus(args);
    console.log(JSON.stringify(result, null, 2));
  },
});

if (import.meta.main) {
  await runMain(main);
}
