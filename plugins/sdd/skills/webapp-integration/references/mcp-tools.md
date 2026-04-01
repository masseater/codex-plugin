# sdd-webapp MCPツール詳細

## ツール詳細

### sdd_webapp_add_project

現在のプロジェクトをWebアプリに登録。

**使用例:**

```
sdd_webapp_add_project を呼び出してプロジェクトを登録
```

**動作:**

- `specs/` ディレクトリが存在するか確認
- 存在する場合、プロジェクトパスと名前を登録

### sdd_webapp_list_projects

登録済みプロジェクト一覧を取得。

**使用例:**

```
sdd_webapp_list_projects で登録済みプロジェクトを確認
```

### sdd_webapp_get_status

タスクのステータスを取得。

**使用例:**

```
sdd_webapp_get_status でタスクの進捗状況を確認
```

**返却情報:**

- タスク一覧
- 各タスクのPhase進捗
- 完了/未完了状態

### sdd_webapp_remove_project

プロジェクトを削除。

**使用例:**

```
sdd_webapp_remove_project でプロジェクトを削除
```
