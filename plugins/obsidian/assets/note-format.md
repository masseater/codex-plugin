# Zettelkasten ノート形式

Vault は `~/Documents/Zettelkasten`。obsidian plugin の skill はすべてこの形式で読み書きする。

## ディレクトリとノート種別

- `00-Literature-Notes/`（`type: literature`）: 文献・Web・コードから読み取った内容を自分の言葉でパラフレーズしたもの。引用は最小限にし、情報源を `sources` に書く
- `01-Fleeting-Notes/`（`type: fleeting`）: 思考の断片。完成度より記録の速さを優先する。Permanent Note に統合したら削除する
- `02-Permanent-Notes/`（`type: permanent`）: Fleeting / Literature Notes から抽出・統合した、単独で再利用できる体系的なまとめ。元になった Literature / Permanent Notes への wikilink を含める（Fleeting は統合後に削除するのでリンクしない）
- `03-Structured-Notes/`（`type: structured`）: テーマに関連するノートへの wikilink を集めた索引。本文は最小限にし、ノート間の関係を示す
- `04-Daily/`: 日記（daily skill が扱う。形式は daily skill を参照）

1 ノートには 1 トピックだけを書く。リンクで再利用できる単位にするため。

## ファイル名

`<slug>.md`。slug は内容を端的に表す日本語または英語のケバブケース（例: `obsidian-vault-設計.md`）。wikilink はこの slug で解決されるので、既存ノートと重複しない名前にする。

## Frontmatter

```yaml
---
type: fleeting | literature | permanent | structured
title: ノートのタイトル
tags:
  - タグ1
sources:
  - "[[別のノート名]]"
  - "https://example.com/article"
links:
  - "[[関連ノート名]]"
created: 2026-06-20T14:30:00+09:00
---
```

- 必須: `type`（配置ディレクトリと一致させる）、`title`、`created`（ISO 8601）
- `sources` は literature では必須、それ以外は任意
- `tags` と `links` は任意

## 本文

- 日本語で書く
- 他のノートとは `[[ノート名]]` で接続する。存在しないノートへのリンクは PostToolUse hook（vault-lint）と Vault の pre-commit hook が検出してコミットを止めるので、指摘されたらリンク先を作るかリンクを直す

## ソースへのリンク

外部の情報源に言及するときは、読者がその箇所へ直接飛べるリンクを書く。名前やタイトルだけでは後から辿れないため。

- GitHub のコード: コミットハッシュ入りの permalink を書く。ブランチ名の URL は後で行がずれるため
  - 形式: `https://github.com/<owner>/<repo>/blob/<commit-hash>/<path>#L<start>-L<end>`
  - 例: `[calculateTotal](https://github.com/org/repo/blob/abc1234/src/utils/calc.ts#L42-L55)`
  - ハッシュは `git log -1 --format='%H' -- <filepath>` で取得する
- GitLab のコード: `https://gitlab.com/<owner>/<repo>/-/blob/<commit-hash>/<path>#L<start>-<end>`
- Bitbucket のコード: `https://bitbucket.org/<owner>/<repo>/src/<commit-hash>/<path>#lines-<start>:<end>`
- Web の記事・ドキュメント: URL を書く。セクションアンカーがあればアンカーまで含める（例: `[React useEffect](https://react.dev/reference/react/useEffect#parameters)`）
- Issue・PR・Discussion: URL を書く。特定のコメントならコメントの permalink にする（例: `[#123 (comment)](https://github.com/org/repo/issues/123#issuecomment-456789)`）
- リモートの無いローカルコード: `` `<filepath>:<line>` `` または `` `<filepath>#L<start>-L<end>` `` で場所を書く

## Git 操作

ノートを作成・更新・削除したら Vault で commit する。

```bash
cd ~/Documents/Zettelkasten && git add -A && git commit -m "<操作内容の要約>"
```

## Vault セットアップ

Vault ディレクトリ、git リポジトリ、壊れた wikilink を止める pre-commit hook のいずれかが無いときは、呼び出し元 skill が示す `setup-vault.sh` を実行する。既にあるものは変更しない。

GitHub へのバックアップはユーザーが望んだときだけ設定する。

```bash
cd ~/Documents/Zettelkasten
gh repo create zettelkasten --private --source=. --push
# リモートが既にある場合
git remote add origin git@github.com:<user>/zettelkasten.git && git push -u origin main
```
