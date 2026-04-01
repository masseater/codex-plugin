# AGENTS.md

このリポジトリは `masseater/claude-code-plugin` の Codex 向けミラーです。

## 重要

- `plugins/` と `.agents/plugins/marketplace.json` は生成物
- 直接修正ではなく `scripts/sync_upstream.py` を修正する
- 同期元 commit は `.sync/upstream.json` を参照する

## 構成

| Directory | Purpose |
| --- | --- |
| `plugins/` | Codex 用に変換されたプラグイン本体 |
| `.agents/plugins/marketplace.json` | Codex marketplace 定義 |
| `scripts/` | 同期・変換ロジック |
| `.github/workflows/` | 定期同期ワークフロー |
