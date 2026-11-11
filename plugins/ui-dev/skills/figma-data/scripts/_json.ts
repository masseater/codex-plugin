/** Figma REST API の JSON をキャストせずに読むための型ガード群 */
export type JsonRecord = Record<string, unknown>;

/**
 * 値が JSON オブジェクト（配列と null を除く）かを判定する。
 * @param value 判定する値
 * @returns JSON オブジェクトなら true
 */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * フィールドが JSON オブジェクトならそれを返す。
 * @param obj 読み出し元のオブジェクト
 * @param key フィールド名
 * @returns JSON オブジェクト。それ以外なら undefined
 */
export function recordField(obj: JsonRecord, key: string): JsonRecord | undefined {
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

/**
 * フィールドが配列なら、その中の JSON オブジェクトだけを返す。
 * @param obj 読み出し元のオブジェクト
 * @param key フィールド名
 * @returns JSON オブジェクトの配列。フィールドが配列でなければ undefined
 */
export function recordArrayField(obj: JsonRecord, key: string): JsonRecord[] | undefined {
  const value = obj[key];
  return Array.isArray(value) ? value.filter((item) => isRecord(item)) : undefined;
}

/**
 * フィールドが文字列ならそれを返す。
 * @param obj 読み出し元のオブジェクト
 * @param key フィールド名
 * @returns 文字列。それ以外なら undefined
 */
export function stringField(obj: JsonRecord, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * フィールドが数値ならそれを返す。
 * @param obj 読み出し元のオブジェクト
 * @param key フィールド名
 * @returns 数値。それ以外なら undefined
 */
export function numberField(obj: JsonRecord, key: string): number | undefined {
  const value = obj[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * fetch のレスポンス本文を JSON オブジェクトとして読む。
 * @param res fetch のレスポンス
 * @returns 本文の JSON オブジェクト
 */
export async function readJsonRecord(res: Response): Promise<JsonRecord> {
  const body: unknown = await res.json();
  if (!isRecord(body)) {
    throw new Error(`Figma API returned a non-object JSON body (${res.url})`);
  }
  return body;
}

/**
 * GET /v1/files/:key/nodes のレスポンスから、指定ノードの document を取り出す。
 * @param data レスポンス本文
 * @param colonId コロン区切りのノード ID
 * @returns ノードの document。見つからなければ null
 */
export function nodeDocument(data: JsonRecord, colonId: string): JsonRecord | null {
  const nodes = recordField(data, "nodes");
  const entry = nodes === undefined ? undefined : recordField(nodes, colonId);
  return entry === undefined ? null : (recordField(entry, "document") ?? null);
}

/**
 * GET /v1/images/:key のレスポンスを読み、ノード ID から画像 URL への対応を返す。
 * @param data レスポンス本文
 * @returns ノード ID から画像 URL（描画できなかったノードは null）への対応
 */
export function imageUrls(data: JsonRecord): Record<string, string | null> {
  const err = stringField(data, "err");
  if (err) {
    throw new Error(`Figma Images API error: ${err}`);
  }
  const images = recordField(data, "images") ?? {};
  return Object.fromEntries(
    Object.entries(images).map(([id, url]) => [id, typeof url === "string" ? url : null]),
  );
}

/**
 * ログに出すノードの表記（名前と種類）を作る。
 * @param doc ノード
 * @returns `名前 (種類)`。読めない項目は ?
 */
export function describeNode(doc: JsonRecord): string {
  return `${stringField(doc, "name") ?? "?"} (${stringField(doc, "type") ?? "?"})`;
}
