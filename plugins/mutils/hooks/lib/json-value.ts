/**
 * 型の付いていない JSON 値（hook の tool_input、transcript の行、DB に保存した JSON など）を
 * キャストせずに読むための型ガード。
 */

/**
 * 値が JSON オブジェクト（null と配列を除く）かを判定する。
 * @param value - 判定する値
 * @returns JSON オブジェクトなら true
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 値が JSON オブジェクトならそのまま、そうでなければ空オブジェクトを返す。
 * @param value - 読む値
 * @returns JSON オブジェクト
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
