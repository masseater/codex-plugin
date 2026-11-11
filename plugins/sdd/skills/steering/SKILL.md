---
name: steering
description: プロジェクトの方針（プロダクト・技術スタック・構造・開発原則）をステアリング文書として .claude/skills/steering/ に作る、または旧配置から移行する。SDD を始めるとき、「プロジェクト方針を整理したい」「steering を作って」と頼まれたときに使う。
---

# ステアリング文書の作成

ステアリング文書は、SDD の全段階が判断の基準にするプロジェクトの方針。`.claude/skills/steering/` に skill として置くので、Claude は文脈に応じて自動で参照する。

## 新規作成

1. テンプレートをコピーする（既存ファイルは上書きしない）

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/copy-templates.ts .claude/skills/steering
   ```

   SKILL.md / product.md / tech.md / structure.md / principles.md ができる

2. README.md・AGENTS.md・package.json など既存の文書とコードを読み、各ファイルをこのプロジェクトに合わせて書く。既存の文書に書いてあることは重ねて書かず、そちらを参照する。具体的なファイル名やコマンドの列挙ではなく、方針の水準で書く。テンプレートに残った一般論（原則の定義など）は、このプロジェクトでの適用方法に置き換えるか消す

## 旧配置からの移行

`specs/_steering/` に product.md / tech.md / structure.md / principles.md がある場合は、`.claude/skills/steering/` に `git mv` で移す。テンプレートの SKILL.md だけを追加でコピーする。`specs/_steering/` が空になったら削除する。

## 完了後

作ったファイルを伝え、次は `/sdd:spec init <作りたいものの説明>` で spec を作ることを案内する。
