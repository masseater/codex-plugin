/**
 * パッケージレジストリ（npm / pypi / crates / go / github）ごとのメタデータ取得ロジック。
 *
 * 各レジストリの差分は「URL 構築」「追加ヘッダー」「レスポンスからのフィールド抽出」
 * 「（github のみ）最新リリースタグの追加取得」の 4 点に閉じているため、
 * 共通骨格（URL 構築 → fetch → ステータス検証 → JSON パース → フィールド抽出 → 任意の enrich）を
 * {@link fetchRegistryEntries} に一本化し、レジストリごとの差分は {@link REGISTRY_CONFIGS} の
 * 宣言的な設定オブジェクトとして表現する。
 */

import { env } from "../../../../env.js";
import { cleanGitUrl } from "./git-url.js";
import { isRecord } from "./type-guards.js";

export type Registry = "npm" | "pypi" | "crates" | "go" | "github";
export type MetaEntries = [string, string][];

export type RegistryFetchConfig = {
  registry: Registry;
  /** パッケージ名 / モジュールパス / owner/repo からリクエスト URL を構築する */
  buildUrl: (name: string) => string;
  /** 追加で必要なリクエストヘッダーを構築する（不要なレジストリは省略可） */
  buildHeaders?: () => Record<string, string>;
  /** レスポンス JSON（Record であることは呼び出し側で保証済み）から MetaEntries を抽出する */
  extractEntries: (data: Record<string, unknown>, name: string, today: string) => MetaEntries;
  /** 主レスポンス取得後に追加リクエストで entries を補完する（github の最新リリース取得など） */
  enrich?: (
    entries: MetaEntries,
    name: string,
    headers: Record<string, string> | undefined,
  ) => Promise<MetaEntries>;
};

// --- 共通の抽出ヘルパー ---

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * 値が文字列のときだけ 1 件のエントリにする
 * @param key エントリのキー
 * @param value レスポンスから取り出した値
 * @returns エントリ。文字列でなければ空
 */
function optionalEntry(key: string, value: unknown): MetaEntries {
  return typeof value === "string" ? [[key, value]] : [];
}

/**
 * 値が空でない文字列のときだけ 1 件のエントリにする
 * @param key エントリのキー
 * @param value レスポンスから取り出した値
 * @returns エントリ。空文字や文字列以外なら空
 */
function nonEmptyEntry(key: string, value: unknown): MetaEntries {
  return typeof value === "string" && value ? [[key, value]] : [];
}

/**
 * パス区切りを残したまま、各要素を URL 用にエスケープする
 * @param value スラッシュ区切りのパス
 * @returns エスケープしたパス
 */
function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

// --- npm ---

function buildNpmUrl(name: string): string {
  return `https://registry.npmjs.org/${encodeURIComponent(name)}`;
}

function npmLatestVersion(data: Record<string, unknown>): string {
  const distTags = data["dist-tags"];
  if (!isRecord(distTags) || typeof distTags.latest !== "string") {
    throw new Error("npm: missing dist-tags.latest");
  }
  return distTags.latest;
}

/**
 * npm の repository フィールド（文字列か { url, directory }）をエントリにする
 * @param repo repository フィールド
 * @returns repository と repository_directory のエントリ
 */
function npmRepositoryEntries(repo: unknown): MetaEntries {
  if (typeof repo === "string") return [["repository", cleanGitUrl(repo)]];
  if (!isRecord(repo) || typeof repo.url !== "string") return [];
  return [
    ["repository", cleanGitUrl(repo.url)],
    ...optionalEntry("repository_directory", repo.directory),
  ];
}

function extractNpmEntries(
  data: Record<string, unknown>,
  name: string,
  today: string,
): MetaEntries {
  const version = npmLatestVersion(data);
  return [
    ["name", stringOr(data.name, name)],
    ["package_name", name],
    ["registry", "npm"],
    ["version", version],
    ["last_updated", today],
    ...optionalEntry("description", data.description),
    ...npmRepositoryEntries(data.repository),
    ...optionalEntry("documentation", data.homepage),
  ];
}

// --- pypi ---

// Try common keys for source / docs
const PYPI_SOURCE_KEYS = ["Source", "Repository", "GitHub", "Homepage"];
const PYPI_DOCS_KEYS = ["Documentation", "Docs"];

function buildPypiUrl(name: string): string {
  return `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  return keys.map((key) => record[key]).find((value): value is string => typeof value === "string");
}

function pypiUrlEntries(projectUrls: unknown): MetaEntries {
  if (!isRecord(projectUrls)) return [];
  return [
    ...optionalEntry("repository", firstString(projectUrls, PYPI_SOURCE_KEYS)),
    ...optionalEntry("documentation", firstString(projectUrls, PYPI_DOCS_KEYS)),
  ];
}

function extractPypiEntries(
  data: Record<string, unknown>,
  name: string,
  today: string,
): MetaEntries {
  const info = data.info;
  if (!isRecord(info)) throw new Error("pypi: missing info");
  return [
    ["name", stringOr(info.name, name)],
    ["package_name", name],
    ["registry", "pypi"],
    ["version", stringOr(info.version, "unknown")],
    ["last_updated", today],
    ...optionalEntry("description", info.summary),
    ...pypiUrlEntries(info.project_urls),
  ];
}

// --- crates ---

function buildCratesUrl(name: string): string {
  return `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
}

function buildCratesHeaders(): Record<string, string> {
  return { "User-Agent": "library-research-script" };
}

function extractCratesEntries(
  data: Record<string, unknown>,
  name: string,
  today: string,
): MetaEntries {
  const crate = data.crate;
  if (!isRecord(crate)) throw new Error("crates: missing crate");
  return [
    ["name", stringOr(crate.name, name)],
    ["package_name", name],
    ["registry", "crates"],
    ["version", stringOr(crate.max_version, "unknown")],
    ["last_updated", today],
    ...optionalEntry("description", crate.description),
    ...optionalEntry("repository", crate.repository),
    ...optionalEntry("documentation", crate.documentation),
  ];
}

// --- go ---

function buildGoUrl(modulePath: string): string {
  return `https://proxy.golang.org/${encodePath(modulePath)}/@latest`;
}

// Infer repo URL from module path (github.com/owner/repo → https://github.com/owner/repo)
function goRepositoryEntries(modulePath: string): MetaEntries {
  const parts = modulePath.split("/");
  return parts.length >= 3 ? [["repository", `https://${parts.slice(0, 3).join("/")}`]] : [];
}

function extractGoEntries(
  data: Record<string, unknown>,
  modulePath: string,
  today: string,
): MetaEntries {
  return [
    ["name", modulePath.split("/").pop() ?? modulePath],
    ["package_name", modulePath],
    ["registry", "go"],
    ["version", stringOr(data.Version, "unknown")],
    ["last_updated", today],
    ...goRepositoryEntries(modulePath),
  ];
}

// --- github ---

function buildGithubUrl(ownerRepo: string): string {
  return `https://api.github.com/repos/${encodePath(ownerRepo)}`;
}

function buildGithubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "library-research-script",
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
  };
}

function extractGithubEntries(
  data: Record<string, unknown>,
  ownerRepo: string,
  today: string,
): MetaEntries {
  return [
    ["name", stringOr(data.name, ownerRepo)],
    ["package_name", ownerRepo],
    ["registry", "github"],
    ["version", ""],
    ["last_updated", today],
    ...optionalEntry("description", data.description),
    ["repository", `https://github.com/${ownerRepo}`],
    ...nonEmptyEntry("documentation", data.homepage),
  ];
}

/**
 * レジストリの API を GET する。
 * @param url 各レジストリの build*Url で組み立てた URL
 * @param headers リクエストヘッダー（不要なら undefined）
 * @returns fetch のレスポンス
 */
async function registryGet(
  url: string,
  headers: Record<string, string> | undefined,
): Promise<Response> {
  // fallow-ignore-next-line security-sink -- URL は各レジストリの固定の origin に、エスケープしたパッケージ名を付けて組み立てる
  return fetch(url, headers && { headers });
}

function latestTagOf(data: unknown): string | undefined {
  return isRecord(data) && typeof data.tag_name === "string" ? data.tag_name : undefined;
}

/**
 * github リポジトリの最新リリースタグを取得する。
 * リリースを一度も作成していないリポジトリは珍しくないため、404 応答は正常系として undefined を返す。
 * @param ownerRepo `owner/repo` 形式のリポジトリ識別子
 * @param headers GitHub API リクエストに使うヘッダー（未指定可）
 * @returns 最新リリースタグ。無ければ undefined
 */
async function fetchLatestTag(
  ownerRepo: string,
  headers: Record<string, string> | undefined,
): Promise<string | undefined> {
  const res = await registryGet(`${buildGithubUrl(ownerRepo)}/releases/latest`, headers);
  // リリース未作成（404 など）は正常系のため、version は空のまま処理を継続する
  if (!res.ok) return undefined;
  return latestTagOf(await res.json());
}

function withVersion(entries: MetaEntries, version: string | undefined): MetaEntries {
  if (version === undefined) return entries;
  return entries.map(([key, value]) => (key === "version" ? [key, version] : [key, value]));
}

/**
 * github リポジトリの最新リリースタグを取得し、entries の version を更新する。
 * @param entries 更新対象の MetaEntries（version エントリを含む）
 * @param ownerRepo `owner/repo` 形式のリポジトリ識別子
 * @param headers GitHub API リクエストに使うヘッダー（未指定可）
 * @returns 最新リリースタグで version を更新した MetaEntries
 */
async function enrichGithubRelease(
  entries: MetaEntries,
  ownerRepo: string,
  headers: Record<string, string> | undefined,
): Promise<MetaEntries> {
  try {
    return withVersion(entries, await fetchLatestTag(ownerRepo, headers));
  } catch (error) {
    // ネットワーク一時障害などで release 取得に失敗しても致命的ではないため、
    // version を空のままにする best-effort 処理として続行する。原因調査用に debug ログを残す。
    console.error(`github: latest release fetch failed for ${ownerRepo}:`, error);
    return entries;
  }
}

// --- 汎用フェッチエンジン ---

/**
 * レジストリの API を呼び、レスポンスを JSON オブジェクトとして読む
 * @param url リクエスト URL
 * @param headers リクエストヘッダー
 * @param registry エラーメッセージに含めるレジストリ名
 * @returns レスポンスの JSON オブジェクト
 */
async function fetchJsonRecord(
  url: string,
  headers: Record<string, string> | undefined,
  registry: Registry,
): Promise<Record<string, unknown>> {
  const res = await registryGet(url, headers);
  if (!res.ok) {
    throw new Error(`${registry}: ${res.status} ${res.statusText}`);
  }
  const data: unknown = await res.json();
  if (!isRecord(data)) {
    throw new Error(`${registry}: unexpected response`);
  }
  return data;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

/**
 * レジストリごとの設定オブジェクトを受け取り、
 * 「URL 構築 → fetch → ステータス検証 → JSON パース → フィールド抽出 → 任意の enrich」を実行する
 * @param name パッケージ名 / モジュールパス / owner/repo
 * @param config 対象レジストリの {@link RegistryFetchConfig}
 * @returns 抽出された MetaEntries
 */
export async function fetchRegistryEntries(
  name: string,
  config: RegistryFetchConfig,
): Promise<MetaEntries> {
  const headers = config.buildHeaders?.();
  const data = await fetchJsonRecord(config.buildUrl(name), headers, config.registry);
  const entries = config.extractEntries(data, name, todayIso());
  return config.enrich ? config.enrich(entries, name, headers) : entries;
}

export const REGISTRY_CONFIGS: Record<Registry, RegistryFetchConfig> = {
  npm: {
    registry: "npm",
    buildUrl: buildNpmUrl,
    extractEntries: extractNpmEntries,
  },
  pypi: {
    registry: "pypi",
    buildUrl: buildPypiUrl,
    extractEntries: extractPypiEntries,
  },
  crates: {
    registry: "crates",
    buildUrl: buildCratesUrl,
    buildHeaders: buildCratesHeaders,
    extractEntries: extractCratesEntries,
  },
  go: {
    registry: "go",
    buildUrl: buildGoUrl,
    extractEntries: extractGoEntries,
  },
  github: {
    registry: "github",
    buildUrl: buildGithubUrl,
    buildHeaders: buildGithubHeaders,
    extractEntries: extractGithubEntries,
    enrich: enrichGithubRelease,
  },
};
