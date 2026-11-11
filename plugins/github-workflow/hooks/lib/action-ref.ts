/**
 * GitHub Actions の workflow から `uses:` の参照を読み取り、バージョンを比べるための純粋関数群。
 */

type ActionRef = {
  path: string;
  repo: string;
  current: string;
};

function parseMajorVersion(version: string): number | null {
  const match = version.match(/^v(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * `owner/repo[/path]@vN[.N...]` 形式の uses を読む。SHA・ブランチ・ローカル action は対象外。
 *
 * @param uses - workflow の uses の値
 * @returns action の参照。対象外の形式なら null
 */
function parseActionRef(uses: string): ActionRef | null {
  const match = uses.match(/^([^@\s]+)@(v\d+(?:\.\d+)*)$/);
  if (!match) return null;

  const path = match[1]!;
  const current = match[2]!;
  const parts = path.split("/");
  if (parts.length < 2) return null;

  return { path, repo: `${parts[0]}/${parts[1]}`, current };
}

function isObject(node: unknown): node is object {
  return typeof node === "object" && node !== null;
}

/**
 * 1 つのキーと値から uses の値を集める。uses 以外のキーは値の中を探す。
 *
 * @param key - オブジェクトのキー
 * @param value - キーの値
 * @returns 見つかった uses の値
 */
function usesValuesOf(key: string, value: unknown): string[] {
  return key === "uses" && typeof value === "string" ? [value] : collectUsesValues(value);
}

/**
 * パース済みの YAML から、すべての `uses:` の文字列値を再帰的に集める。
 *
 * @param node - パース済みの YAML ノード
 * @returns uses の値（出現順）
 */
function collectUsesValues(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectUsesValues);
  if (!isObject(node)) return [];
  return Object.entries(node).flatMap(([key, value]) => usesValuesOf(key, value));
}

/**
 * タグ一覧から最大の major version を選ぶ。
 *
 * @param tags - リポジトリのタグ名
 * @returns `v<major>` 形式の最大バージョン。バージョン形式のタグが無ければ null
 */
function pickMaxMajorVersion(tags: string[]): string | null {
  const majors = tags.map(parseMajorVersion).filter((major): major is number => major !== null);
  return majors.length > 0 ? `v${Math.max(...majors)}` : null;
}

/**
 * 現在のバージョンより新しい major version かを判定する。
 *
 * @param current - 現在のバージョン
 * @param latest - 最新のバージョン
 * @returns latest の major が current より大きければ true
 */
function isOlderMajor(current: string, latest: string): boolean {
  const currentMajor = parseMajorVersion(current);
  const latestMajor = parseMajorVersion(latest);
  return currentMajor !== null && latestMajor !== null && currentMajor < latestMajor;
}

export { collectUsesValues, isOlderMajor, parseActionRef, pickMaxMajorVersion };
export type { ActionRef };
