/**
 * Resolve a GitHub issue reference (owner / repo / number) from either an
 * issue URL or a bare issue number combined with the current git remote.
 */

import type { RemoteWithRefs } from "simple-git";
import { simpleGit } from "simple-git";

/** A GitHub repository identified by its owner and name. */
export type RepoRef = {
  owner: string;
  repo: string;
};

/** A GitHub issue identified by its repository and issue number. */
export type IssueRef = RepoRef & {
  issueNumber: number;
};

const ISSUE_URL_RE = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/issues\/(\d+)/;
const ORIGIN_RE = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/;

/**
 * Extract an issue reference from a GitHub issue URL.
 *
 * @param input - A string that may be a GitHub issue URL.
 * @returns The parsed issue reference, or null when the input is not a recognizable issue URL.
 */
export function parseIssueUrl(input: string): IssueRef | null {
  const match = input.trim().match(ISSUE_URL_RE);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return { owner: match[1], repo: match[2], issueNumber: Number(match[3]) };
}

/**
 * Extract a bare issue number from input like `123` or `#123`.
 *
 * @param input - A string that may be a bare issue number.
 * @returns The parsed issue number, or null when the input is not a bare number.
 */
export function parseIssueNumber(input: string): number | null {
  const match = input.trim().match(/^#?(\d+)$/);
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Parse `owner/repo` from a git remote fetch URL (https or ssh form).
 *
 * @param fetchUrl - A git remote fetch URL.
 * @returns The parsed repository, or null when the URL does not point at GitHub.
 */
export function parseOriginRemote(fetchUrl: string): RepoRef | null {
  const match = fetchUrl.match(ORIGIN_RE);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Resolve owner / repo from the `origin` remote of the current repository.
 *
 * @returns The repository pointed at by the `origin` remote.
 */
async function resolveRepoFromGit(): Promise<RepoRef> {
  const remotes = await simpleGit().getRemotes(true);
  const origin = remotes.find((r: RemoteWithRefs) => r.name === "origin");
  if (!origin?.refs.fetch) {
    throw new Error("No origin remote found");
  }
  const repo = parseOriginRemote(origin.refs.fetch);
  if (!repo) {
    throw new Error(`Could not parse GitHub owner/repo from origin: ${origin.refs.fetch}`);
  }
  return repo;
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
    const repo = await resolveRepoFromGit();
    return { ...repo, issueNumber };
  }
  throw new Error(
    `Could not parse issue reference: "${input}". Pass an issue number (e.g. 42) or a GitHub issue URL.`,
  );
}
