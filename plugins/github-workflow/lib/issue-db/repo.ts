import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  IDENTIFIER_PATTERN,
  isValidOwnerRepo,
  parseRemoteUrl,
  type RepoRef,
} from "./remote-url.ts";

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

export function dbPathFor(ref: RepoRef, cwd: string = process.cwd()): string {
  if (!isValidOwnerRepo(ref)) {
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
