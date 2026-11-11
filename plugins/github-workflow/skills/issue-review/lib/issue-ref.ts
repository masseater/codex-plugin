/**
 * Resolve a GitHub issue reference (owner / repo / number) from either an
 * issue URL or a bare issue number combined with the current git remote.
 */

import { type GitHubRepo, resolveOriginRepo } from "../../../lib/git-origin.ts";

/** A GitHub issue identified by its repository and issue number. */
export type IssueRef = GitHubRepo & {
  issueNumber: number;
};

const ISSUE_URL_RE = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/issues\/(\d+)/;

/**
 * Extract an issue reference from a GitHub issue URL.
 *
 * @param input - A string that may be a GitHub issue URL.
 * @returns The parsed issue reference, or null when the input is not a recognizable issue URL.
 */
function parseIssueUrl(input: string): IssueRef | null {
  const match = input.trim().match(ISSUE_URL_RE);
  return match ? issueRefFromMatch(match) : null;
}

function issueRefFromMatch([, owner, repo, issueNumber]: RegExpMatchArray): IssueRef | null {
  return owner && repo && issueNumber ? { owner, repo, issueNumber: Number(issueNumber) } : null;
}

/**
 * Extract a bare issue number from input like `123` or `#123`.
 *
 * @param input - A string that may be a bare issue number.
 * @returns The parsed issue number, or null when the input is not a bare number.
 */
function parseIssueNumber(input: string): number | null {
  const match = input.trim().match(/^#?(\d+)$/);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Resolve a full issue reference from user input. Accepts a GitHub issue URL
 * (self-contained) or a bare issue number (resolved against the git remote).
 *
 * @param input - An issue number (`42`, `#42`) or a GitHub issue URL.
 * @returns The resolved issue reference.
 */
export async function parseIssueRef(input: string): Promise<IssueRef> {
  const fromUrl = parseIssueUrl(input);
  if (fromUrl) {
    return fromUrl;
  }
  const issueNumber = parseIssueNumber(input);
  if (issueNumber !== null) {
    const repo = await resolveOriginRepo();
    return { ...repo, issueNumber };
  }
  throw new Error(
    `Could not parse issue reference: "${input}". Pass an issue number (e.g. 42) or a GitHub issue URL.`,
  );
}
