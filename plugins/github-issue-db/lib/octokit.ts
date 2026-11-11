import { Octokit } from "octokit";
import type { RepoRef } from "./repo.ts";

export function getGhToken(host?: string): string {
  const args = host && host !== "github.com" ? ["auth", "token", "-h", host] : ["auth", "token"];
  const proc = Bun.spawnSync(["gh", ...args]);
  if (proc.exitCode !== 0) {
    throw new Error(`gh auth token failed: ${new TextDecoder().decode(proc.stderr).trim()}`);
  }
  const token = new TextDecoder().decode(proc.stdout).trim();
  if (!token) throw new Error("gh auth token returned empty — run `gh auth login`.");
  return token;
}

export function getOctokit(ref?: Pick<RepoRef, "host">): Octokit {
  const host = ref?.host ?? "github.com";
  const baseUrl = host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;
  return new Octokit({ auth: getGhToken(host), baseUrl });
}
