#!/usr/bin/env bun
/**
 * update-index.ts
 * ~/.claude/skills/temp/ ディレクトリをスキャンして SKILL.md のインデックスセクションを更新するスクリプト
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Glob } from "bun";

// パス定義
const TEMP_DIR = join(homedir(), ".claude", "skills", "temp");
const SKILL_DIR = dirname(import.meta.dir);
const SKILL_MD = join(SKILL_DIR, "SKILL.md");

type Frontmatter = {
  name?: string;
  description?: string;
  created?: string;
  tags?: string[];
};

/** Markdownファイルからフロントマターをパースする（CRLF対応） */
function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const frontmatter: Frontmatter = {};
  for (const line of (match[1] as string).split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key === "name") frontmatter.name = value;
    else if (key === "description") frontmatter.description = value;
    else if (key === "created") frontmatter.created = value;
    else if (key === "tags") {
      frontmatter.tags = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return frontmatter;
}

/** ~/.claude/skills/temp/ 内の .md ファイルをスキャンしてエントリ一覧を生成する */
async function collectEntries(): Promise<string[]> {
  mkdirSync(TEMP_DIR, { recursive: true });

  const glob = new Glob("*.md");
  const filenames: string[] = [];
  for await (const file of glob.scan(TEMP_DIR)) {
    filenames.push(file);
  }
  filenames.sort();

  const entries: string[] = [];
  for (const file of filenames) {
    const content = await Bun.file(join(TEMP_DIR, file)).text();
    const fm = parseFrontmatter(content);
    const name = fm.name || file.replace(/\.md$/, "");
    const description = fm.description || "（説明なし）";
    entries.push(`- [${name}](~/.claude/skills/temp/${file}) — ${description}`);
  }
  return entries;
}

/** SKILL.md のインデックスセクションを更新する */
async function updateIndex(entries: string[]): Promise<void> {
  const skillFile = Bun.file(SKILL_MD);
  if (!(await skillFile.exists())) {
    console.error(`SKILL.md が見つかりません: ${SKILL_MD}`);
    process.exit(1);
  }

  const skillMd = await skillFile.text();

  if (!skillMd.includes("<!-- INDEX_START -->")) {
    console.warn("警告: INDEX_START / INDEX_END マーカーが見つかりません。");
    return;
  }

  const indexContent = entries.length > 0 ? entries.join("\n") : "(No entries yet)";

  const updated = skillMd.replace(
    /<!-- INDEX_START -->[\s\S]*?<!-- INDEX_END -->/,
    `<!-- INDEX_START -->\n${indexContent}\n<!-- INDEX_END -->`,
  );

  await Bun.write(SKILL_MD, updated);
}

// メイン処理
try {
  const entries = await collectEntries();
  console.log(`${entries.length} 件のエントリを検出`);
  await updateIndex(entries);
  console.log("SKILL.md のインデックスを更新完了");
  if (entries.length > 0) {
    console.log("\n--- インデックス ---");
    for (const e of entries) {
      console.log(e);
    }
  }
} catch (err) {
  console.error("エラーが発生しました:", err);
  process.exit(1);
}
