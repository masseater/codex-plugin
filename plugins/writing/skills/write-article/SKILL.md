---
name: write-article
description: 会話の内容や指定されたトピックから Zenn の技術記事を書き、ユーザーのレビューを経て `masseater/zenn-article` リポジトリに PR を出す。
disable-model-invocation: true
---

# Zenn 記事の作成

## 手順

1. 素材を決める。トピックの指定があればそれを主題にし、会話は参照材料として使う。指定が無ければ、このセッションの技術的な内容を記事に再構成する。会話をそのまま貼らない
2. 記事を書く（形式と文体は下記）。文章の基底規範として `../good-writing/SKILL.md` に従う
3. 記事をユーザーに見せ、承認されるまでフィードバックを反映する。PR は外部リポジトリへの公開を伴うので、承認を得るまで投稿に進まない
4. リポジトリに PR を出す（下記「投稿」）

## リポジトリ

- GitHub: `masseater/zenn-article`、default branch は `master`
- 記事は `articles/`、画像は `images/`
- ローカルパスは `${CLAUDE_PLUGIN_DATA}/repo-path.txt` から読む。無ければユーザーに聞き、そのファイルに保存して次回から使う。plugin の更新で消えないよう、保存先は `${CLAUDE_PLUGIN_DATA}` にする

## 形式

```yaml
---
title: "記事タイトル"
emoji: "内容に合う絵文字 1 つ"
type: "tech"
topics: [既存の Zenn タグを優先、最大 5 個]
published: false
---
```

- `published` は常に `false` にする。公開するかどうかはユーザーが Zenn 上で決める
- ファイル名は内容を表すケバブケースの slug（例: `claude-code-plugin-intro.md`）。ランダムなハッシュは使わない
- 構成: frontmatter の直後に「tl;dr」（要点 1〜3 行）、「はじめに」（背景と動機）、本文、「おわりに」または「まとめ」（振り返りと次の一手）。節は短くし、長くなったら分ける

## 文体（著者の過去記事から抽出）

- 日本語で書く。技術用語・ライブラリ名・コマンドは英語のまま（`Claude Code`、`git worktree`、`Bun`）
- 読者は主要なツール（Claude Code、TypeScript、Git、React など）を知っている前提で書き、「X は Y をするツールです」のような導入は省く。文脈上必要でも 1 行まで。説明するのは記事の中心になるニッチなツールだけ
- 書くのは「著者が何をして、なぜそうして、何が分かったか」。ツールの使い方の解説記事にはしない
- です/ます調を基本に、くだけた表現を混ぜる。読者に直接話しかけてよい（例: `Claude Code、使ってますよね？ 使ってる前提で詳しい説明は省きます`）
- `これはなかなか面白い結果だと思いました`、`効いてるかは分かりません。気分です` のような率直な感想を書く。本当に面白いところでだけ、自虐やツッコミを入れる（例: `なんだこれ……まあいいか`）
- 本題から書き始める。`〜をご紹介したいと思います` のような丁寧すぎる前置きや、`見ていきましょう！`・`いかがでしたか？` のような定型句は使わない
- 散文の方が伝わる内容は散文で書き、箇条書きは本当に列挙のときだけにする
- 分からないことは分からないと書く
- コードブロックには言語を指定する。実際のソースへの GitHub リンクを積極的に入れ、構成の説明で図のほうが伝わるときは mermaid を使う
- Zenn 記法（`:::details`、`:::message`、URL 単独行の自動埋め込み）を活用する
- 画像が必要なら、ユーザーに Zenn の画像アップロード機能を使うよう伝える（ローカル画像は `images/`）

## 投稿

```bash
cd <repo-path>
git checkout master && git pull
git checkout -b article/<slug>
# articles/<slug>.md を作成
git add articles/<slug>.md
git commit -m "Add article: <title>"
git push -u origin article/<slug>
gh pr create --title "Add article: <title>" --body "- <記事の要約>
- published: false（下書き）"
```

作成した PR の URL をユーザーに伝える。
