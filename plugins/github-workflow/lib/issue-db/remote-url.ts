export type RepoRef = {
  host: string;
  owner: string;
  repo: string;
};

const HOST_PATTERN = /^([^/:]+)(?::\d+)?[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/;
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

/**
 * owner と repo がファイル名にも使える GitHub の識別子の形かを判定する。
 *
 * @param ref - 判定するリポジトリ参照
 * @returns 両方とも IDENTIFIER_PATTERN に合えば true
 */
export function isValidOwnerRepo(ref: Pick<RepoRef, "owner" | "repo">): boolean {
  return IDENTIFIER_PATTERN.test(ref.owner) && IDENTIFIER_PATTERN.test(ref.repo);
}

// Strip transport/scheme prefixes so the pattern can focus on host[:port][:/]owner/repo.
function stripRemotePrefix(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^git@/, "")
    .replace(/^ssh:\/\/git@/, "")
    .replace(/^ssh:\/\//, "");
}

function repoRefFromMatch([, host, owner, repo]: RegExpExecArray): RepoRef | null {
  if (!host || !owner || !repo) return null;
  return { host, owner, repo };
}

/**
 * git remote の URL（https / git@ / ssh://）から host・owner・repo を読み取る。
 *
 * @param url - git remote の URL
 * @returns リポジトリ参照。読み取れないか owner/repo が識別子の形でなければ null
 */
export function parseRemoteUrl(url: string): RepoRef | null {
  const match = HOST_PATTERN.exec(stripRemotePrefix(url));
  const ref = match ? repoRefFromMatch(match) : null;
  return ref && isValidOwnerRepo(ref) ? ref : null;
}
