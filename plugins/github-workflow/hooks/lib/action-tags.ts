import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { pickMaxMajorVersion } from "./action-ref.ts";

const logger = HookLogger.fromFile(import.meta.filename);

/**
 * gh api 1 回あたりの上限。hook は async 実行で Claude Code が timeout を強制しないので、
 * 応答しない gh プロセスが残らないようここで打ち切る
 */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * リポジトリのタグから最新の major version を取得する。
 *
 * @param repo - `owner/repo` 形式のリポジトリ名
 * @returns `v<major>` 形式の最新バージョン。取得できなければ null
 */
async function fetchLatestMajorVersion(repo: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["gh", "api", `repos/${repo}/tags?per_page=50`, "--jq", ".[].name"], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: FETCH_TIMEOUT_MS,
    });
    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const tags = stdout.trim().split("\n").filter(Boolean);

    return pickMaxMajorVersion(tags);
  } catch (error) {
    // タグを取れない action（gh 未ログイン、private repo など）は更新提案から外すだけで安全
    logger.debug(`Failed to fetch tags for ${repo}: ${String(error)}`);
    return null;
  }
}

export { fetchLatestMajorVersion };
