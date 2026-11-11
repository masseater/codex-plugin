import { readFileSync } from "node:fs";
import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { parse } from "yaml";
import { type ActionRef, collectUsesValues, isOlderMajor, parseActionRef } from "./action-ref.ts";
import { fetchLatestMajorVersion } from "./action-tags.ts";

const logger = HookLogger.fromFile(import.meta.filename);

type OutdatedAction = {
  name: string;
  current: string;
  latest: string;
};

function isGitHubWorkflowFile(filePath: string): boolean {
  return /\.github\//.test(filePath) && /\.ya?ml$/.test(filePath);
}

function readWorkflowContent(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    // 編集直後に削除・移動されたファイルは検査対象がないだけなので、提案をしないで終える
    logger.debug(`Failed to read ${filePath}: ${String(error)}`);
    return undefined;
  }
}

/**
 * workflow の YAML をパースする。
 *
 * @param content - workflow ファイルの内容
 * @returns パース結果。不正な YAML なら undefined
 */
function parseWorkflowYaml(content: string): unknown {
  try {
    return parse(content);
  } catch (error) {
    // 編集途中の不正な YAML は actions のバージョン検査の対象外。構文エラーは別の手段で検出される
    logger.debug(`Failed to parse workflow YAML: ${String(error)}`);
    return undefined;
  }
}

/**
 * workflow から、バージョン指定の action 参照を重複なく取り出す。
 *
 * @param content - workflow ファイルの内容
 * @returns action の参照（同じ action@version は 1 つにまとめる）
 */
function extractActionRefs(content: string): ActionRef[] {
  const refs = collectUsesValues(parseWorkflowYaml(content))
    .map(parseActionRef)
    .filter((ref): ref is ActionRef => ref !== null);
  return [...new Map(refs.map((ref) => [`${ref.path}@${ref.current}`, ref])).values()];
}

/**
 * action のリポジトリごとに最新の major version を取得する。同じリポジトリは 1 回だけ問い合わせる。
 *
 * @param refs - action の参照
 * @returns リポジトリ名から最新バージョンへの対応。取得できなかったリポジトリは含めない
 */
async function latestVersionsByRepo(refs: ActionRef[]): Promise<Map<string, string>> {
  const repos = [...new Set(refs.map((ref) => ref.repo))];
  const results = await Promise.all(
    repos.map(async (repo) => [repo, await fetchLatestMajorVersion(repo)] as const),
  );
  return new Map(results.filter((entry): entry is readonly [string, string] => entry[1] !== null));
}

async function findOutdatedActions(refs: ActionRef[]): Promise<OutdatedAction[]> {
  const latestByRepo = await latestVersionsByRepo(refs);
  return refs.flatMap((ref) => {
    const latest = latestByRepo.get(ref.repo);
    return latest !== undefined && isOlderMajor(ref.current, latest)
      ? [{ name: ref.path, current: ref.current, latest }]
      : [];
  });
}

function formatSuggestions(outdated: OutdatedAction[]): string {
  const lines = ["[GitHub Actions Update] 参考: より新しい major version がある action"];

  for (const action of outdated) {
    lines.push(`- ${action.name}: ${action.current} → ${action.latest}`);
  }

  return lines.join("\n");
}

export {
  extractActionRefs,
  findOutdatedActions,
  formatSuggestions,
  isGitHubWorkflowFile,
  readWorkflowContent,
};
export type { OutdatedAction };
