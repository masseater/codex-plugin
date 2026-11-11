#!/usr/bin/env bun
/**
 * ライブラリナレッジベースの index.md（各ライブラリ）と SKILLS.md（トップレベル）を自動生成
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { defineCommand, runMain } from "citty";
import { parse as parseYaml } from "yaml";
import {
  type AnalysisJson,
  extractFrontmatter,
  generateLibraryIndex,
  generateSkillsIndex,
  type IndexedLibrary,
  isMetaYml,
  isTopicFrontmatter,
  type MetaYml,
  type Topic,
  toAnalysisJson,
} from "./lib/knowledge-index.js";
import { getKnowledgeRoot } from "./lib/resolve-knowledge-dir.js";
import { isRecord } from "./lib/type-guards.js";

async function readAnalysisJson(libDir: string): Promise<AnalysisJson | null> {
  const file = Bun.file(join(libDir, "analysis.json"));
  if (!(await file.exists())) return null;
  try {
    const parsed: unknown = await file.json();
    return isRecord(parsed) ? toAnalysisJson(parsed) : null;
  } catch (error) {
    // 壊れた analysis.json は「解析結果なし」と同じ扱いにし、索引の生成自体は続ける
    console.error(
      `warn: ${join(libDir, "analysis.json")} を JSON として読めないので無視する:`,
      error,
    );
    return null;
  }
}

async function readMeta(baseDir: string, metaPath: string): Promise<MetaYml | null> {
  const parsed: unknown = parseYaml(await Bun.file(join(baseDir, metaPath)).text());
  if (!isMetaYml(parsed)) {
    console.error(`Invalid meta.yml: ${metaPath}`);
    return null;
  }
  return parsed;
}

async function readTopic(libDir: string, file: string): Promise<Topic | null> {
  const fm = extractFrontmatter(await Bun.file(join(libDir, file)).text());
  return fm && isTopicFrontmatter(fm) ? { file, fm } : null;
}

async function readTopics(libDir: string): Promise<Topic[]> {
  const files = await Array.fromAsync(new Glob("*.md").scan({ cwd: libDir }));
  const topics = await Promise.all(
    files.filter((file) => file !== "index.md").map((file) => readTopic(libDir, file)),
  );
  return topics
    .filter((topic): topic is Topic => topic !== null)
    .toSorted((a, b) => a.file.localeCompare(b.file));
}

/**
 * 1 つのライブラリの index.md を生成する
 * @param baseDir ナレッジベースのルート
 * @param metaPath ルートからの meta.yml のパス
 * @returns 索引に載せるライブラリ。meta.yml が不正なら null
 */
async function indexLibrary(baseDir: string, metaPath: string): Promise<IndexedLibrary | null> {
  const meta = await readMeta(baseDir, metaPath);
  if (!meta) return null;
  const dirName = metaPath.replace("/meta.yml", "");
  const libDir = join(baseDir, dirName);
  const analysis = await readAnalysisJson(libDir);
  await Bun.write(
    join(libDir, "index.md"),
    generateLibraryIndex(meta, await readTopics(libDir), analysis),
  );
  return { meta, dirName };
}

async function processBaseDir(baseDir: string, libraries: IndexedLibrary[]): Promise<void> {
  if (!existsSync(baseDir)) return;
  for await (const metaPath of new Glob("*/meta.yml").scan({ cwd: baseDir })) {
    const library = await indexLibrary(baseDir, metaPath);
    if (library) libraries.push(library);
  }
}

const main = defineCommand({
  meta: {
    name: "generate-index",
    description: "ライブラリナレッジベースの index.md と SKILLS.md を自動生成",
  },
  args: {
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) のナレッジを対象にする",
      default: false,
    },
  },
  async run({ args }) {
    const baseDir = getKnowledgeRoot(args.user);

    if (!existsSync(baseDir)) {
      console.log(JSON.stringify({ generated: [], total: 0, baseDir }));
      return;
    }

    const libraries: IndexedLibrary[] = [];
    await processBaseDir(baseDir, libraries);

    libraries.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

    const skillsContent = generateSkillsIndex(libraries);
    await Bun.write(join(baseDir, "SKILLS.md"), skillsContent);

    console.log(
      JSON.stringify({
        generated: libraries.map((l) => l.dirName),
        total: libraries.length,
        baseDir,
      }),
    );
  },
});

await runMain(main);
