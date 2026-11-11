import { type DB, openDb } from "./db.ts";
import type { RepoRef } from "./remote-url.ts";
import { dbPathFor, resolveRepoFromGit } from "./repo.ts";

/** issue-db の CLI が受け取る、対象リポジトリを上書きする引数 */
export type RepoArgs = {
  host?: string | undefined;
  owner?: string | undefined;
  repo?: string | undefined;
};

/**
 * CLI 引数で owner と repo の両方が指定されていればそれを、無ければ git remote の origin を対象にする。
 *
 * @param args - CLI 引数
 * @returns 対象リポジトリ
 */
export function resolveRepoRef(args: RepoArgs): RepoRef {
  if (!args.owner || !args.repo) return resolveRepoFromGit();
  return { host: args.host || "github.com", owner: args.owner, repo: args.repo };
}

/**
 * 対象リポジトリの issue DB を開いて処理を実行し、最後に必ず閉じる。
 *
 * @param ref - 対象リポジトリ
 * @param fn - 開いた DB を使う処理
 * @returns fn の戻り値
 */
export async function withIssueDb<T>(
  ref: RepoRef,
  fn: (db: DB, dbPath: string) => T | Promise<T>,
): Promise<T> {
  const dbPath = dbPathFor(ref);
  const db = openDb(dbPath);
  try {
    return await fn(db, dbPath);
  } finally {
    db.close();
  }
}

/**
 * 件数の上限を表す CLI 引数を整数にする。
 *
 * @param raw - CLI 引数の文字列
 * @param fallback - 整数として読めないときの値
 * @returns 上限の件数
 */
export function parseLimit(raw: string, fallback: number): number {
  const limit = Number.parseInt(raw, 10);
  return Number.isFinite(limit) ? limit : fallback;
}
