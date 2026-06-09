# zenn-article Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Zenn技術記事の執筆・投稿支援プラグイン。

## Overview

会話コンテキストや指定トピックから Zenn 向け技術記事を生成し、GitHub リポジトリへの push / PR 作成まで行う。

## Zenn Repository

- リポジトリ: `masseater/zenn-article`
- ローカルパス: `config/repo-path.txt` に保存（初回はユーザーに確認）
- 記事パス: `articles/{slug}.md`

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `zenn-article:write-article`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                       | Description                                                                                                                                                                                          |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | zenn-article:write-article | This skill should be used when the user asks to "write a Zenn article", "Zenn記事を書いて", "publish tech blog", "会話を記事化", or wants conversation context turned into a Zenn technical article. |

<!-- END:component-list -->
