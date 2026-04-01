# zenn-article Plugin Development Guide

Zenn技術記事の執筆・投稿支援プラグイン。

## Overview

会話コンテキストや指定トピックから Zenn 向け技術記事を生成し、GitHub リポジトリへの push / PR 作成まで行う。

## Zenn Repository

- リポジトリ: `masseater/zenn-article`
- ローカルパス: `config/repo-path.txt` に保存（初回はユーザーに確認）
- 記事パス: `articles/{slug}.md`

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name          | Description                                                                                                                                                       |
| ----- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | write-article | Write and publish Zenn tech articles. Use when the user asks to write a Zenn article, publish a tech blog post, or turn conversation context into a Zenn article. |

<!-- END:component-list -->
