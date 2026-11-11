---
name: setup
description: mutils の個人ルール（assets/AGENTS.md）を `~/AGENTS.md` に同期し、`~/.claude/CLAUDE.md` から読み込まれるようにして、依存をインストールする。
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/sync-agents-md.ts *), Bash(bun install), Bash(bun install *)
---

# setup

## 1. ~/AGENTS.md を同期する

```bash
${CLAUDE_SKILL_DIR}/scripts/sync-agents-md.ts --src ../../assets/AGENTS.md
```

スクリプトは `~/AGENTS.md` の `<!-- BEGIN mutils:agents-md -->` 〜 `<!-- END mutils:agents-md -->` の中だけを書き換え、マーカーの外には触れない。マーカー内のユーザー編集は、前回適用した内容（`~/.claude/mutils/setup-baseline-agents-md.md`）を共通祖先とする 3-way merge で mutils 側の更新と両立させる。あわせて `~/.claude/CLAUDE.md` に `@~/AGENTS.md` の import 行が無ければ追加する（CLAUDE.md を持つプロジェクトでは `~/AGENTS.md` が直接は読まれないため）。

出力 JSON の `status` に応じて次のようにする。

```text
created / appended / unchanged / merged:
  完了。importAdded が true なら ~/.claude/CLAUDE.md に import 行を足したことも報告する
needs-baseline（前回の適用記録が無く、マーカー内が配布内容と違う）:
  files.inside（現在のマーカー内）と files.src（配布内容）の差分を見せ、
  AskUserQuestion で「配布内容で上書き / 現在の内容を残す / 手でマージする」を聞く
  決まった内容をファイルに書き、--resolve <file> を付けて再実行する
conflict（ユーザー編集と配布内容の更新が同じ箇所に当たった）:
  files.conflict のコンフリクト箇所を見せ、どちらを採るか、または解消した内容をユーザーに決めてもらう
  解消した内容をファイルに書き、--resolve <file> を付けて再実行する
```

`--resolve` で確定したあとも、出力の `importAdded` を報告に含める。

## 2. 依存をインストールする

`../..` から親ディレクトリをたどって `bun.lock` があるディレクトリを探す。見つかったら `bun install --cwd <そのディレクトリ>` を実行する（`cd` と組み合わせると allowed-tools の事前承認に一致しないため）。見つからない場合（plugin キャッシュでは SessionStart hook がインストール済み）は何もしない。

## 3. 報告する

- `~/AGENTS.md` の同期結果（status）と、merge・解消した場合はどの部分がユーザー編集由来でどの部分が配布内容由来か
- `~/.claude/CLAUDE.md` に import 行を足したか
- `bun install` を実行したディレクトリと結果
