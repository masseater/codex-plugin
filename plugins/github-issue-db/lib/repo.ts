import { mkdirSync } from "node:fs";
import path from "node:path";

export type RepoRef = {
  host: string;
  owner: string;
  repo: string;
};

const HOST_PATTERN = /^([^/:]+)(?::\d+)?[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

export function resolveRepoFromGit(): RepoRef {
  const proc = Bun.spawnSync(["git", "remote", "get-url", "origin"]);
  if (proc.exitCode !== 0) {
    throw new Error(`git remote failed: ${new TextDecoder().decode(proc.stderr).trim()}`);
  }
  const url = new TextDecoder().decode(proc.stdout).trim();
  const parsed = parseRemoteUrl(url);
  if (!parsed) {
    throw new Error(`could not parse owner/repo from remote URL: ${url}`);
  }
  const hostOverride = process.env.GITHUB_HOST?.trim();
  return { ...parsed, host: hostOverride || parsed.host };
}

export function parseRemoteUrl(url: string): RepoRef | null {
  // Strip transport/scheme prefixes so the pattern can focus on host[:port][:/]owner/repo.
  const stripped = url
    .replace(/^https?:\/\//, "")
    .replace(/^git@/, "")
    .replace(/^ssh:\/\/git@/, "")
    .replace(/^ssh:\/\//, "");
  const match = HOST_PATTERN.exec(stripped);
  if (!match) return null;
  const [, host, owner, repo] = match;
  if (!host || !owner || !repo) return null;
  if (!IDENTIFIER_PATTERN.test(owner) || !IDENTIFIER_PATTERN.test(repo)) return null;
  return { host, owner, repo };
}

export function dbPathFor(ref: RepoRef, cwd: string = process.cwd()): string {
  if (!IDENTIFIER_PATTERN.test(ref.owner) || !IDENTIFIER_PATTERN.test(ref.repo)) {
    throw new Error(
      `invalid owner/repo for DB path: owner=${ref.owner} repo=${ref.repo}. ` +
        `allowed: ${IDENTIFIER_PATTERN}`,
    );
  }
  const dir = path.resolve(cwd, ".agents", "cache", "issues");
  mkdirSync(dir, { recursive: true });
  const hostSlug = ref.host === "github.com" ? "" : `${sanitizeHost(ref.host)}__`;
  const file = path.resolve(dir, `${hostSlug}${ref.owner}-${ref.repo}.sqlite`);
  // Belt-and-braces: after both values pass the pattern, the resolved path
  // must still live under `dir`. Anything else is a bug in the validator.
  if (!file.startsWith(`${dir}${path.sep}`)) {
    throw new Error(`DB path escaped cache directory: ${file}`);
  }
  return file;
}

function sanitizeHost(host: string): string {
  return host.replace(/[^A-Za-z0-9._-]/g, "_");
}
