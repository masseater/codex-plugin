import { execFileSync } from "node:child_process";
import { Octokit } from "octokit";
import type { RepoRef } from "./issue-db/remote-url.ts";

export type RunGh = (args: string[]) => string;

const defaultRunGh: RunGh = (args) =>
  execFileSync("gh", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

/**
 * GitHub API トークンを解決する。github.com では `GITHUB_TOKEN` を優先し、
 * 未設定なら `gh auth token` を使う（ローカル CLI では通常 `GITHUB_TOKEN` が無いため）。
 *
 * @param host - GitHub のホスト名
 * @param env - 参照する環境変数（テスト用に差し替え可能）
 * @param runGh - gh を実行する関数（テスト用に差し替え可能）
 * @returns API トークン
 */
export function resolveGithubToken(
  host = "github.com",
  env: NodeJS.ProcessEnv = process.env,
  runGh: RunGh = defaultRunGh,
): string {
  return envToken(host, env) || ghAuthToken(host, runGh);
}

/**
 * github.com のときだけ `GITHUB_TOKEN` を読む。
 *
 * @param host - GitHub のホスト名
 * @param env - 参照する環境変数
 * @returns トークン。github.com 以外か未設定なら undefined
 */
function envToken(host: string, env: NodeJS.ProcessEnv): string | undefined {
  return host === "github.com" ? env["GITHUB_TOKEN"]?.trim() : undefined;
}

/**
 * `gh auth token` でトークンを取得する。github.com 以外はホストを指定する。
 *
 * @param host - GitHub のホスト名
 * @param runGh - gh を実行する関数
 * @returns API トークン
 */
function ghAuthToken(host: string, runGh: RunGh): string {
  const args = host === "github.com" ? ["auth", "token"] : ["auth", "token", "-h", host];
  const token = runGh(args).trim();
  if (!token) throw new Error("gh auth token returned empty — run `gh auth login`.");
  return token;
}

export function getOctokit(ref?: Pick<RepoRef, "host">): Octokit {
  const host = ref?.host ?? "github.com";
  const baseUrl = host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;
  return new Octokit({ auth: resolveGithubToken(host), baseUrl });
}
