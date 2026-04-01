---
name: sdd:webapp-integration
description: |
  sdd-webappとの連携ガイド。以下の状況で使用する:
  (1) ユーザーが「sdd-webapp」「ダッシュボード」と言った時
  (2) sdd-webappのMCPツールを使いたい時
  (3) 仕様書の進捗をビジュアルで確認したい時
---

| ツール                      | 用途                                     |
| --------------------------- | ---------------------------------------- |
| `sdd_webapp_add_project`    | プロジェクト登録（steering時に呼び出し） |
| `sdd_webapp_list_projects`  | 登録済みプロジェクト一覧                 |
| `sdd_webapp_get_status`     | specステータス取得                       |
| `sdd_webapp_remove_project` | プロジェクト削除                         |
