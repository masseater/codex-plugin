# github-issue-db Plugin Development Guide

GitHub issue をローカル SQLite にクローンし、オフラインで重複検知・類似検索・状態同期を行うプラグイン。

## Overview

- 初回同期: `octokit.paginate(issues.listForRepo)` で open/closed 全件を取得し `.agents/cache/issues/<owner>-<repo>.sqlite` に保存
- 以降は `since` パラメータで増分同期
- 検索は SQLite FTS5（trigram tokenizer）の BM25 ランキングに、ラベル Jaccard と recency ブーストを重ねた純 DB 実装。重い埋め込みモデルは持たない
- 将来的に semantic search が必要になった場合の拡張ポイント: `sqlite-vec` 等の拡張を opt-in で読み込む設計余地を残す

## Development Commands

```bash
cd plugins/github-issue-db

bun run check        # oxlint
bun run check:fix    # oxlint --fix
bun run typecheck    # tsgo --noEmit
bun run test         # vitest
```

## Core Concepts

### DB Path

`.agents/cache/issues/<owner>-<repo>.sqlite` — リポジトリ毎に分離。

### Tables

- `issues` — number, title, body, state, author, created_at, updated_at, closed_at, url, labels_json, comments_json
- `issues_fts` — FTS5 virtual table (title, body, labels) with `tokenize='trigram'` — 日英問わず 3-char n-gram マッチ
- `sync_meta` — key/value: schema_version, last_sync, last_full_sync, total_at_last_sync

### Sync Contract

- 初回は full fetch
- 以降は `since = max(last_sync - 60s, epoch)` で listForRepo、`pull_request` を除外して upsert
- ラベル/コメントプレビュー（最大3件, 各400chars）も同時更新
- 5% 以上の総件数ジャンプで強制フル再同期

### Search Contract

1. クエリを NFKC 正規化・FTS5 演算子をサニタイズ
2. FTS5 `MATCH` + `bm25()` で top 200 まで prune
3. 合成スコア: `0.7 * bm25_norm + 0.2 * label_jaccard + 0.1 * recency`
   - `bm25_norm`: bm25 の min-max 正規化（higher-better）
   - `label_jaccard`: クエリ側ラベルと候補ラベルの Jaccard 類似度
   - `recency`: `1 / (1 + days_since_updated / 365)` のスムーズ減衰
4. 上位 N を返す（デフォルト 10）

## Scripts

| スクリプト          | 用途                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `scripts/sync.ts`   | 現在のリポジトリの issue を DB に同期（初回/増分自動判定）                  |
| `scripts/search.ts` | クエリ or finding JSON で DB 検索し候補と recommendation を返す             |
| `scripts/show.ts`   | 指定 number の issue を DB から出力                                         |
| `scripts/list.ts`   | label / updated-since / authored-by / numbers / state フィルタで issue 一覧 |

全て `--help` で使い方を表示。

## 運用

### DB の場所・リセット

| 操作           | コマンド / パス                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------- |
| DB パス        | `.agents/cache/issues/<owner>-<repo>.sqlite`（`github.com` 以外は `<host>__<owner>-<repo>.sqlite`） |
| 全リセット     | DB ファイルを削除して次回 sync でフル再構築                                                         |
| 強制フル再同期 | `scripts/sync.ts --force`                                                                           |
| スキーマ再構築 | `SCHEMA_VERSION` bump → 次回 open で `migrateIfNeeded` が自動対応（v1→v2 済）                       |
| WAL 残存       | `.sqlite-wal` / `.sqlite-shm` もまとめて削除して OK                                                 |

TTL は設けていない。`fetchIssueCount` で総数を見て 5% 以上変動したら自動フル再同期するので、古びてもそのまま使える。

### GitHub Enterprise

環境変数 `GITHUB_HOST=ghe.example.com` を設定するか、各スクリプトに `--host ghe.example.com --owner <o> --repo <r>` を渡す。`gh auth token -h <host>` で enterprise 用トークンを取得し、Octokit の `baseUrl` を `https://<host>/api/v3` に切り替える。

## Rules

- 外部 API は GitHub のみ。ML モデルは持たず、純 SQLite のみで検索が完結する
- DB スキーマ変更時はマイグレーション番号を `sync_meta.schema_version` に書き込む（`migrateIfNeeded` がトークナイザ変更も検出して自動再構築）
- 複数 Claude セッションが同時実行されても安全にするため、書き込みはトランザクションで囲む
- 大規模 repo 初回同期（数千件）は進捗ログを stderr に出す

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                   | Description                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | report-repo-issues     | End-to-end triage — investigate the repo, dedupe against the local issue DB, and for each finding either comment on an existing issue or create a new one. Use when the user says "課題を洗い出してissue化", "リポジトリを調査してissueにする", "report repo issues", "investigate and file issues", "問題を見つけてGitHubに上げる", or wants an end-to-end flow from code to GitHub. |
| skill | search-similar-issues  | Search GitHub issues from a locally-cached SQLite DB (FTS5 trigram + BM25 + label/recency boost, no ML model) for duplicates or near-duplicates of a proposed issue. Use when the user says "似たissueを探す", "duplicate issue check", "search similar issues", "類似issueを調べる", "既存issueを検索", or before creating a new issue to avoid duplicates.                          |
| skill | update-existing-issues | Verify selected GitHub issues against the current repository state using the local issue DB, post status comments, and — with explicit approval — close resolved ones. Use when the user says "既存issueを更新", "issueの状態を確認", "update existing issues", "issue triage", "古いissueをcloseする", or wants to refresh stale issues with the latest repo reality.                |

<!-- END:component-list -->
