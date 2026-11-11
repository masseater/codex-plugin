/**
 * ナレッジベースのディレクトリ解決と自動生成
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SKILL_MD_TEMPLATE = `---
description: 過去に調査したライブラリ・フレームワーク・ツールのナレッジベース。ライブラリの使い方、API、互換性、比較情報が必要な時に参照する。「〜の使い方」「〜のAPI」「〜と〜の違い」「前に調べた〜」と言われた時に使用する。
---

# Library Knowledge Base

過去のライブラリ調査結果を蓄積するナレッジベース。

## インデックス

調査済みライブラリの一覧は [SKILLS.md](SKILLS.md) を参照。

## 使い方

- 特定のライブラリの詳細を知りたい場合は、該当する \`.md\` ファイルを参照
- 新規調査が必要な場合は \`/research:library-research\` を使用
`;

/**
 * ライブラリ名をディレクトリ名として使える形に正規化
 * - `@octokit/rest` → `octokit-rest`
 * - `express` → `express`
 */
export function normalizeName(name: string): string {
  return name.replace(/^@/, "").replace(/\//g, "-");
}

/**
 * library-knowledge のルートディレクトリを返す
 */
export function getKnowledgeRoot(user: boolean): string {
  if (user) {
    return join(homedir(), ".claude", "skills", "library-knowledge");
  }
  return join(process.cwd(), ".claude", "skills", "library-knowledge");
}

/**
 * ライブラリ名に対応するナレッジディレクトリのパスを解決し、必要に応じて作成する
 *
 * - ディレクトリが未作成なら mkdirSync で作成
 * - library-knowledge の SKILL.md が未配置なら自動生成
 */
export function resolveKnowledgeDir(name: string, user: boolean): string {
  const root = getKnowledgeRoot(user);
  const dirName = normalizeName(name);
  const dir = join(root, dirName);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const skillMdPath = join(root, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    writeFileSync(skillMdPath, SKILL_MD_TEMPLATE, "utf-8");
  }

  return dir;
}
