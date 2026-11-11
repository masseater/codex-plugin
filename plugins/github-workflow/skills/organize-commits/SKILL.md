---
name: organize-commits
description: 作業ツリーの変更を関心ごとに分けたコミット計画を提示し、承認後にその単位でコミットする。
disable-model-invocation: true
---

# Organize Commits

$ARGUMENTS

1. `git status`、`git diff`、`git diff --staged` で変更を把握する。既定ブランチは `git symbolic-ref --short refs/remotes/origin/HEAD` で確認する
2. 変更を関心ごと（機能追加、バグ修正、リファクタリング、依存更新、設定、テスト、ドキュメントなど）で分け、コミット計画を提示する。各コミットについて、メッセージ案と含めるファイル（同じファイル内で関心が混ざる場合はハンク）を箇条書きにする
3. `AskUserQuestion` で、そのまま実行・メッセージ修正・グループ変更・中止を確認する
4. 承認後、`git reset` で一度アンステージし、グループごとに `git add`（ハンク単位なら `git add -p` ではなくパッチを作って `git apply --cached`）してコミットする
5. `git log --oneline <既定ブランチ>..HEAD` を示して終える

コミットの決め方:

- 1 コミット 1 関心にし、各コミットが単独でビルド・テストを通る順に並べる。型定義の変更はそれを使う変更より前に置く
- メッセージは Conventional Commits 形式（`<type>(<scope>): <subject>`）で、subject と本文は日本語で書く。本文には変更の理由を書く
- WIP コミットは作らない
- 既存のコミットの書き換え（rebase、amend）はしない。対象は未コミットの変更だけ
