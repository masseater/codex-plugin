#!/usr/bin/env bun
/**
 * visited.json の読み書きを管理し、訪問済みURL/検索クエリの重複を防止する
 */

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { resolveKnowledgeDir } from "./lib/resolve-knowledge-dir.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readVisited(filePath: string): Promise<VisitedJson> {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    try {
      const parsed: unknown = await file.json();
      if (isRecord(parsed)) {
        return {
          urls: isRecord(parsed.urls) ? (parsed.urls as Record<string, VisitedEntry>) : {},
          searches: isRecord(parsed.searches)
            ? (parsed.searches as Record<string, SearchEntry>)
            : {},
        };
      }
    } catch {
      // corrupted file, start fresh
    }
  }
  return { urls: {}, searches: {} };
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
      if (!args.key) {
        throw new Error("--check には --key が必要です");
      }
      const inUrls = args.key in visited.urls;
      const inSearches = args.key in visited.searches;
      const found = inUrls || inSearches;
      console.log(
        JSON.stringify({
          key: args.key,
          visited: found,
          type: inUrls ? "url" : inSearches ? "search" : null,
          entry: inUrls ? visited.urls[args.key] : inSearches ? visited.searches[args.key] : null,
        }),
      );
      return;
    }

    // Add mode: 新しいエントリを追加
    if (!args.type || !args.key || !args.summary) {
      throw new Error("--type, --key, --summary は必須です");
    }

    const today = new Date().toISOString().split("T")[0] ?? "";

    if (args.type === "url") {
      visited.urls[args.key] = {
        visited_at: today,
        summary: args.summary,
      };
    } else if (args.type === "search") {
      visited.searches[args.key] = {
        searched_at: today,
        results_summary: args.summary,
      };
    } else {
      throw new Error("--type は url または search を指定してください");
    }

    await Bun.write(filePath, JSON.stringify(visited, null, 2));
    console.log(
      JSON.stringify({
        added: { type: args.type, key: args.key },
        totalUrls: Object.keys(visited.urls).length,
        totalSearches: Object.keys(visited.searches).length,
      }),
    );
  },
});

runMain(main);
