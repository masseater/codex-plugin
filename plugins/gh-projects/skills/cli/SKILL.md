---
name: cli
disable-model-invocation: true
description: gh-projects の CLI（gh-project.ts）で Projects v2 の item・Status、sub-issue、blocked-by を 1 件ずつ操作する。
---

# gh-projects CLI

```bash
../../scripts/gh-project.ts <command> [args]
```

コマンドと引数は `../../scripts/gh-project.ts help` で確認する。`gh` 本体にない sub-issue・blocked-by・`deps:show`・`status:set` を GraphQL で扱う。

## 落とし穴

- `project` スコープがないと GraphQL のミューテーションがすべて失敗する（`Resource not accessible by integration`）。`gh auth refresh -s project` で付与する
- `block:add <owner/repo> <blocked#> <blocking#>` は、ブロックされる側が先。逆に登録しやすい
- `addSubIssue` の `INVALID_ARGUMENT` は、子が既に別の親を持っているか循環している。`sub-issue:list` で現在の親を確認する
- `addBlockedBy` の `INVALID_ARGUMENT` は、自己参照か登録済み。`deps:show` で現状を確認する
- `Could not resolve to a node with the global id` は、Issue が削除されたか別リポジトリの番号
- `status:set` の値は Project の Status フィールドに存在する option 名と完全一致させる。ない場合は使える option 名の一覧がエラーで出る
- `deps:show` は sub-issue 50 件、blocked-by 20 件までしか取らない

方針（どこに sub-issue / blocked-by を使うか）は `epic-story-task` に従う。
