---
name: context-refactor
description: プロジェクトのコンテキストファイル（AGENTS.md / CLAUDE.md / .claude/rules / README.md）を読み、各記述の置き場所を振り分けて再配置する。置き場所の候補は AGENTS.md 階層・path-scoped rule・skill・hook・README である。「AGENTS.md を整理して」「CLAUDE.md を分解して」「CLAUDE.md を AGENTS.md に移行して」と頼まれたときに使う。引数でファイルを指定するとそのファイルだけを対象にする。
argument-hint: "[file-path]"
---

# context-refactor

コンテキストファイルの記述を、読み込まれるタイミングと強制力に合った置き場所へ移す。

## 対象

- 引数あり: 指定したファイルだけ
- 引数なし: プロジェクト全体の `**/AGENTS.md`、`**/CLAUDE.md`、`.claude/rules/**/*.md`、ルートと公開パッケージの `README.md`。monorepo は `package.json` の `workspaces` や `pnpm-workspace.yaml` からパッケージを把握する

`node_modules/` と生成物は対象外にする。

## 手順

1. 対象ファイルを読み、見出し単位に分ける。`@path` の import は展開せず参照として扱う
2. 各記述を [placement-criteria.md](references/placement-criteria.md) の基準で分類する。分類先は「残す / 別の AGENTS.md / path-scoped rule / skill / hook / README / 削除」
3. 計画を 1 回だけ提示して承認を得る。計画には、移動元の見出し・移動先のパス・削除する記述とその理由を箇条書きで載せる。このスキルはユーザーのファイルを大きく書き換えるので、書き込みの前に全体像を見せる
4. 承認された計画を適用する
   - AGENTS.md・README は [templates.md](references/templates.md) の構成に合わせる
   - hook を作る場合、cc-hooks-ts plugin があれば `cc-hooks-ts:cc-hooks-ts` skill の書き方に従う
   - 書く言語は対象プロジェクトの既存ドキュメントに合わせる
5. 作成・更新・削除したファイルの一覧と、移さずに残した記述（理由付き）を報告する

## CLAUDE.md の扱い

Claude Code は AGENTS.md を直接読む。ただし作業ディレクトリかその上位に CLAUDE.md があると、AGENTS.md ではなく CLAUDE.md を読む。

- 中身のある CLAUDE.md: 内容を同じディレクトリの AGENTS.md へ移す（AGENTS.md があれば既存の AGENTS.md を基にマージする）。移したあとの CLAUDE.md は削除する
- `@AGENTS.md` だけ、または AGENTS.md への symlink の CLAUDE.md: そのまま残す。どちらも AGENTS.md を一度だけ読ませる
- Claude Code にだけ効かせたい指示がある場合: CLAUDE.md の先頭に `@AGENTS.md` を置き、その下に書く
- Windows で clone される可能性があるリポジトリでは、symlink ではなく `@AGENTS.md` import を使う。Git が symlink を 1 行のテキストとして checkout するため

## 一覧を手で書かない

skill 一覧・コマンド一覧・ディレクトリ構成のような、コードから導ける一覧を AGENTS.md や README に手書きで追加しない。すぐに古くなり、古い一覧は Claude に誤った前提を与える。リポジトリに自動生成の仕組み（lint の sync ルールなど）があればそれに任せる。
