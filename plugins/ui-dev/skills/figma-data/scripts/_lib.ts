import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { env } from "../../../env.js";
import { nodeDocument, readJsonRecord, type JsonRecord } from "./_json.ts";

export function getToken(): string {
  const token = env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN is not set");
  return token;
}

export function toColon(id: string): string {
  return id.replace(/-/g, ":");
}

export function toDash(id: string): string {
  return id.replace(/:/g, "-");
}

export function log(verbose: boolean, msg: string): void {
  if (verbose) console.error(msg);
}

const FIGMA_API_ORIGIN = "https://api.figma.com";

/**
 * Figma REST API を GET する。
 * @param pathSegments `/v1/` に続くパスの要素（ファイルキーなどはここでエスケープする）
 * @param params クエリパラメータ（指定した順に付ける）
 * @param token Figma のアクセストークン
 * @returns fetch のレスポンス
 */
export async function figmaGet(
  pathSegments: string[],
  params: Record<string, string>,
  token: string,
): Promise<Response> {
  const url = new URL(`/v1/${pathSegments.map(encodeURIComponent).join("/")}`, FIGMA_API_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  // fallow-ignore-next-line security-sink -- origin は固定の Figma API で、パスの各要素は encodeURIComponent でエスケープしている
  return fetch(url, { headers: { "X-Figma-Token": token } });
}

/**
 * Figma REST API を GET し、本文を JSON オブジェクトとして返す。
 * @param pathSegments `/v1/` に続くパスの要素
 * @param params クエリパラメータ
 * @param token Figma のアクセストークン
 * @param apiName 失敗時のエラーメッセージに含める API 名
 * @returns 本文の JSON オブジェクト
 */
export async function figmaJson(
  pathSegments: string[],
  params: Record<string, string>,
  token: string,
  apiName: string,
): Promise<JsonRecord> {
  const res = await figmaGet(pathSegments, params, token);
  if (!res.ok) {
    throw new Error(`${apiName} failed: ${res.status} ${res.statusText}`);
  }
  return readJsonRecord(res);
}

/**
 * ノードを 1 つ取得し、その document を返す。
 * @param fileKey Figma のファイルキー
 * @param nodeId ノード ID（コロン区切りかダッシュ区切り）
 * @param token Figma のアクセストークン
 * @param extraParams 追加のクエリパラメータ（geometry など）
 * @returns ノードの document。見つからなければ null
 */
export async function fetchNodeDocument(
  fileKey: string,
  nodeId: string,
  token: string,
  extraParams: Record<string, string> = {},
): Promise<JsonRecord | null> {
  const data = await figmaJson(
    ["files", fileKey, "nodes"],
    { ids: nodeId, ...extraParams },
    token,
    "Figma API",
  );
  return nodeDocument(data, toColon(nodeId));
}

/**
 * JSON を --output のファイルに書くか、指定が無ければ標準出力に出す。
 * @param output 出力ファイルのパス（無ければ標準出力）
 * @param json 出力する JSON 文字列
 */
export async function writeJsonOutput(output: string | undefined, json: string): Promise<void> {
  if (output) {
    await Bun.write(output, json);
    console.log(`output=${output}`);
  } else {
    console.log(json);
  }
}

/**
 * Figma API が返した画像の URL からファイルをダウンロードする。
 * @param imageUrl Figma API が返した画像の URL（https のみ受け付ける）
 * @param outputPath 保存先のパス
 */
export async function downloadFile(imageUrl: string, outputPath: string): Promise<void> {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Refusing to download from a non-https URL: ${imageUrl}`);
  }
  // fallow-ignore-next-line security-sink -- Figma API が返した画像の URL だけを渡し、https 以外は直前で拒否している
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, buffer);
}
