/**
 * 現在のリポジトリの origin remote から GitHub の owner / repo を読み取る。
 */

import { type RemoteWithRefs, simpleGit } from "simple-git";

/** A GitHub repository identified by its owner and name. */
export type GitHubRepo = {
  owner: string;
  repo: string;
};

/** resolveOriginRepo が使う git クライアントの操作。テストでは remote 一覧だけを差し替える */
type RemoteLister = { getRemotes(verbose: true): Promise<RemoteWithRefs[]> };

const ORIGIN_RE = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/;

/**
 * Parse `owner/repo` from a git remote fetch URL (https or ssh form).
 *
 * @param fetchUrl - A git remote fetch URL.
 * @returns The parsed repository, or null when the URL does not point at GitHub.
 */
function parseOriginRemote(fetchUrl: string): GitHubRepo | null {
  const [, owner, repo] = fetchUrl.match(ORIGIN_RE) ?? [];
  return owner && repo ? { owner, repo } : null;
}

/**
 * Resolve owner / repo from the `origin` remote of the current repository.
 *
 * @param git - The git client (defaults to the current directory).
 * @returns The repository pointed at by the `origin` remote.
 */
export async function resolveOriginRepo(git: RemoteLister = simpleGit()): Promise<GitHubRepo> {
  const remotes = await git.getRemotes(true);
  const fetchUrl = remotes.find((remote) => remote.name === "origin")?.refs.fetch;
  if (!fetchUrl) {
    throw new Error("No origin remote found");
  }
  const repo = parseOriginRemote(fetchUrl);
  if (!repo) {
    throw new Error(`Could not parse GitHub URL from origin: ${fetchUrl}`);
  }
  return repo;
}
