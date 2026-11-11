/**
 * library-research スクリプト群で共有する型ガード。
 * JSON レスポンス / パース結果がオブジェクトかどうかを判定する用途で使う。
 */

/**
 * 値がプレーンオブジェクト（配列・null を除く object）かどうかを判定する。
 * @param value 判定対象の値
 * @returns プレーンオブジェクトなら true
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
