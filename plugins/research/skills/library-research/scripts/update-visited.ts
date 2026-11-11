#!/usr/bin/env bun
/**
 * visited.json の読み書きを管理し、訪問済みURL/検索クエリの重複を防止する
 */

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { resolveKnowledgeDir } from "./lib/resolve-knowledge-dir.js";
import { isRecord } from "./lib/type-guards.js";

type VisitedEntry = {
  visited_at: string;
  summary: string;
};

type SearchEntry = {
  searched_at: string;
  results_summary: string;
};

type VisitedJson = {
  urls: Record<string, VisitedEntry>;
  searches: Record<string, SearchEntry>;
};

function toVisitedEntry(value: unknown): VisitedEntry | undefined {
  return isRecord(value) &&
    typeof value.visited_at === "string" &&
    typeof value.summary === "string"
    ? { visited_at: value.visited_at, summary: value.summary }
    : undefined;
}

function toSearchEntry(value: unknown): SearchEntry | undefined {
  return isRecord(value) &&
    typeof value.searched_at === "string" &&
    typeof value.results_summary === "string"
    ? { searched_at: value.searched_at, results_summary: value.results_summary }
    : undefined;
}

/**
 * visited.json の urls / searches を、形の合うエントリだけに絞って読む。
 * @param value urls または searches の値
 * @param toEntry 1 エントリを検証して変換する関数
 * @returns 形の合うエントリだけを持つオブジェクト
 */
function entriesOf<T>(
  value: unknown,
  toEntry: (entry: unknown) => T | undefined,
): Record<string, T> {
  if (!isRecord(value)) return {};
  const result: Record<string, T> = {};
  for (const [key, entry] of Object.entries(value)) {
    const converted = toEntry(entry);
    if (converted !== undefined) result[key] = converted;
  }
  return result;
}

async function readVisited(filePath: string): Promise<VisitedJson> {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    try {
      const parsed: unknown = await file.json();
      if (isRecord(parsed)) {
        return {
          urls: entriesOf(parsed.urls, toVisitedEntry),
          searches: entriesOf(parsed.searches, toSearchEntry),
        };
      }
    } catch (error) {
      // 訪問記録はキャッシュなので、壊れていたら空から作り直してよい
      console.error(`warn: ${filePath} が壊れているので空の訪問記録から始める:`, error);
    }
  }
  return { urls: {}, searches: {} };
}

/**
 * key が訪問済みかを調べる
 * @param visited 訪問記録
 * @param key URL または検索クエリ
 * @returns 訪問済みか、どちらの記録にあるか、そのエントリ
 */
function checkResult(visited: VisitedJson, key: string): Record<string, unknown> {
  if (key in visited.urls) return { key, visited: true, type: "url", entry: visited.urls[key] };
  if (key in visited.searches) {
    return { key, visited: true, type: "search", entry: visited.searches[key] };
  }
  return { key, visited: false, type: null, entry: null };
}

/** 記録タイプごとの、エントリの追加方法 */
const ENTRY_ADDERS = new Map<
  string,
  (visited: VisitedJson, key: string, summary: string, today: string) => void
>([
  [
    "url",
    (visited, key, summary, today) => {
      visited.urls[key] = { visited_at: today, summary };
    },
  ],
  [
    "search",
    (visited, key, summary, today) => {
      visited.searches[key] = { searched_at: today, results_summary: summary };
    },
  ],
]);

type AddArgs = { type: string; key: string; summary: string };

function requireAddArgs(args: {
  type?: string | undefined;
  key?: string | undefined;
  summary?: string | undefined;
}): AddArgs {
  if (!args.type || !args.key || !args.summary) {
    throw new Error("--type, --key, --summary は必須です");
  }
  return { type: args.type, key: args.key, summary: args.summary };
}

function addEntry(visited: VisitedJson, { type, key, summary }: AddArgs): void {
  const add = ENTRY_ADDERS.get(type);
  if (!add) {
    throw new Error("--type は url または search を指定してください");
  }
  add(visited, key, summary, new Date().toISOString().split("T")[0] ?? "");
}

function requireKey(key: string | undefined): string {
  if (!key) {
    throw new Error("--check には --key が必要です");
  }
  return key;
}

const main = defineCommand({
  meta: {
    name: "update-visited",
    description: "visited.json の訪問済みURL/検索クエリを管理",
  },
  args: {
    name: {
      type: "string",
      description: "ライブラリ名",
      required: true,
    },
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) を参照",
      default: false,
    },
    type: {
      type: "string",
      description: "記録タイプ: url または search",
    },
    key: {
      type: "string",
      description: "URL または検索クエリ",
    },
    summary: {
      type: "string",
      description: "取得した情報の要約",
    },
    check: {
      type: "boolean",
      description: "キーが訪問済みかチェックのみ行う",
      default: false,
    },
  },
  async run({ args }) {
    const dir = resolveKnowledgeDir(args.name, args.user);
    const filePath = join(dir, "visited.json");
    const visited = await readVisited(filePath);

    // Check mode: key が訪問済みか確認
    if (args.check) {
      console.log(JSON.stringify(checkResult(visited, requireKey(args.key))));
      return;
    }

    // Add mode: 新しいエントリを追加
    const added = requireAddArgs(args);
    addEntry(visited, added);

    await Bun.write(filePath, JSON.stringify(visited, null, 2));
    console.log(
      JSON.stringify({
        added: { type: added.type, key: added.key },
        totalUrls: Object.keys(visited.urls).length,
        totalSearches: Object.keys(visited.searches).length,
      }),
    );
  },
});

await runMain(main);
