---
name: pr-watch
description: 単一の PR を conflict・behind・CI 失敗・未解決レビューの順に判定し、ローカルで直して push しながら merge 完了まで見届ける。状態確認だけの 1 回モードもある。
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/*)
---

# PR Watch

対象 PR は引数の PR 番号・URL・ブランチ名、なければ現在のブランチの PR。複数 PR をまとめて処理する依頼は `pr-queue` を使う。

下のスクリプトは現在のブランチの PR しか扱えない。対象 PR のブランチが現在のブランチと違う場合は、`git status --porcelain` で未コミットの変更がないことを確かめてから `gh pr checkout <pr>` で切り替えて始める。未コミットの変更がある場合は、切り替えると作業が混ざるので、切り替えずに状況を報告して止まる。

## モード

- 確認モード: 「PR の状態を見て」のように確認だけを頼まれたとき。下のループを 1 周だけ判定し、状態と次にすべきことを報告して終える。ファイル変更・push・merge はしない
- 対応モード（既定）: 判定に従って直し、push し、merge 完了まで続ける。依頼が特定の項目（「レビュー指摘だけ直して」など）に限られるときは、その項目を片付けた時点で終える

## スクリプト

`${CLAUDE_SKILL_DIR}/scripts/` にあり、現在のブランチの PR を対象に JSON を出力する。トークンは `GITHUB_TOKEN`、なければ `gh auth token` を使う。

- `get-ci-status.ts [--name <部分一致>]`: check run ごとの状態と `overallStatus`（success / failure / pending / neutral）。失敗した check が 1 つでもあれば、未完了の check があっても `failure` になる。cancelled など成功でも neutral / skipped でもない結果も `failure` に数える
- `get-ci-logs.ts [--name <部分一致>] [--all]`: 失敗した job のフルログを `.local-agents/tmp/ci-logs/pr-<n>/` に保存する。`gh run view --log` は job 数が多いと取りこぼすので使わない
- `get-unresolved-threads.ts`: 未解決かつ outdated でないレビュースレッドの ID（`PRRT_...`）
- `get-comments-by-thread.ts --thread-id <id>`: スレッドのファイル・行・コメント

## 判定ループ

```pseudocode
last_push_at = 最後に PR へ push した時刻（未 push なら開始時刻）

loop:
  s = gh pr view <pr> --json number,url,state,isDraft,mergeable,mergeStateStatus,autoMergeRequest,reviewDecision,baseRefName
  if s.mergeable is null: 2 秒間隔で 3 回まで取り直す。まだ null なら次の周回へ

  if s.state in [MERGED, CLOSED]: 報告して終了
  if s.mergeStateStatus == DIRTY:  base を merge して conflict を解消 → verify-merge → push; continue
  if s.mergeStateStatus == BEHIND: base を merge → verify-merge → push; continue

  ci = get-ci-status.ts
  if ci.overallStatus == failure: 原因を直す → commit → push; continue
  if ci.overallStatus == pending: 待つ; continue

  threads = get-unresolved-threads.ts
  if threads に未対応のものがある: ローカルで直す → commit → push; continue

  if s.isDraft: draft であることを報告して終了（ready にするかはユーザーが決める）
  if merge 可能 (CLEAN か HAS_HOOKS、かつ reviewDecision が APPROVED か不要):
    if s.autoMergeRequest: merge を待つ
    else: gh pr merge <pr> --squash
    continue
  外部要因で止まっている（レビュー待ち、merge queue、必須 check の外部サービス待ち）:
    if now - last_push_at >= 3 時間: ブロッカーと必要な対応を報告して終了
    待つ; continue

# push するたびに last_push_at = now に更新する
```

conflict を CI より先に見るのは、conflict 中は `pull_request` の workflow が起動せず、CI を待っても結果が来ないため。判定に迷う状態（`BLOCKED` の意味、null の扱い、check の取りこぼしなど）は [references/pitfalls.md](references/pitfalls.md) を読む。

前の周回で対処済みかつ新しい状態変化がない項目（再レビュー待ちのスレッドなど）は直し直さず、外部の変化を待つ。

## 各段の手順

base の取り込み:

- rebase ではなく merge で取り込む: `git fetch origin <base> && git merge origin/<base>`
- conflict は片側を丸ごと採用せず、ブランチの意図と base の新しい契約を両方残す形で解く。丸ごと採用してよいのは生成物と lockfile だけで、lockfile はパッケージマネージャで再生成する
- 解消後、push の前に `verify-merge` を実行し、問題があれば直してから push する
- push が reject されたら `git fetch && git merge @{u}` で統合して push し直す

CI 失敗:

- `get-ci-logs.ts` でログを取り、原因に対する最小の修正を作る。該当パッケージのテストや型チェックをローカルで通してから commit・push する
- workflow 自体の問題や run 単位のログが要る場合は `debug-gha` の手順に切り替える
- 外部サービス障害・権限不足・secret 不足など自分で直せない失敗は、修正を作らずに原因と必要な対応を報告する

レビュー指摘:

- 各スレッドを `get-comments-by-thread.ts` で読み、ローカルで修正する。PR へ返信やコメントはしない
- 修正が不要と判断した指摘だけユーザーに確認する。ユーザーに確認できない実行環境（`pr-queue` のサブエージェントなど）では、その指摘には手を付けず、指摘の内容と不要と判断した理由を報告に含める

merge:

- auto-merge が設定済みなら自分では merge しない
- merge は `--squash` で行う
- merge 後は `state` が `MERGED` になったことを確認して完了とする

## 待ち方

`gh pr checks --watch` と `gh run watch` は使わない。待っている間に behind や conflict への変化を検出できないため。

- CI の完了待ち: Monitor で `gh pr view <pr> --json state,mergeStateStatus` と `gh pr checks <pr>` を 30〜60 秒間隔でポーリングする。`MERGED` / `CLOSED`、`DIRTY` / `BEHIND`、check の完了のいずれかで抜ける
- 長い待ち（レビュー、merge queue、外部ブロッカー）: メインセッションでは ScheduleWakeup で 1200 秒後の再開を予約する。サブエージェントでは ScheduleWakeup が使えないので Monitor で待つ

## 終了条件

`MERGED` / `CLOSED` で終える。外部ブロッカーで止まっている場合も、最後に PR を変更（push）してから 3 時間は監視を続ける。CI の再実行や後続の merge による behind が数時間以内に起きやすく、早く打ち切ると merge までの完了を取りこぼすため。3 時間経ってもブロッカーが続くなら、その内容と必要な対応を報告して終える。

完了時は PR URL、行った更新（base merge、conflict 解消、CI 修正、レビュー対応）、最終状態、実行したローカル検証を短く報告する。
