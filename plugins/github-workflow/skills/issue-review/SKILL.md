---
name: issue-review
description: 1 件、または条件で選んだ複数の GitHub Issue が現在のコードで解決済みかを証拠付きで判定し、承認を得てからコメント・ラベル・close を更新する。
disable-model-invocation: true
allowed-tools: Bash(../../scripts/issue-db/*)
---

# Issue Review

判定までは読み取りだけで進め、Issue への書き込みは手順 5 の承認を得てから行う。ユーザーへの質問は、対象 Issue の選択と更新内容の承認だけにする。それ以外の不明点はコードと履歴を調べて埋める。ユーザーとの対話は日本語、Issue へのコメントは英語で書く。

## 1. 対象を決める

- 単一モード: Issue 番号・`#42`・Issue URL が与えられたとき
- 一括モード: 条件で選ぶとき。条件は必須で、指定がなければ `AskUserQuestion` で聞く。「全件」にはしない（実リポジトリでは数千件になるため）

一括モードの候補は、キャッシュを同期してから条件で絞る。

```bash
../../scripts/issue-db/sync.ts
../../scripts/issue-db/list.ts [--numbers 42,57] [--label bug,confirmed] [--updated-since <ISO8601>] [--authored-by <user>] [--state open|closed|all] --limit 20
../../scripts/issue-db/search.ts "<キーワード>" --limit 20   # 本文やタイトルの語で選ぶ場合
```

`--label` はカンマ区切りで AND、完全一致。処理件数の上限は既定 20 件なので、`--limit 20` を付ける。ユーザーがそれ以上を求めたら `--limit` を増やし、50 件を超える場合は件数を示して 2 回目の確認を取る。

次の Issue は除外し、理由を記録する。

- `do-not-touch` / `wontfix` ラベルが付いている
- 1 時間以内に人間が更新している（作業中の人と競合するため）
- 直近 3 件のコメントに、24 時間以内のマーカー `<!-- posted by github-workflow:issue-review -->` がある

## 2. Issue を読む

単一モードはコメント全文を取る。

```bash
gh issue view <number-or-url> --json number,title,body,state,labels,comments,url,updatedAt
```

一括モードはキャッシュの `../../scripts/issue-db/show.ts <number>` を使う。コメントのプレビューで判断がつかない Issue だけ `gh issue view` で全文を取る。

## 3. 完了条件を作る

本文とすべてのコメントから「何が満たされれば完了か」のチェックリストを作る。後のコメントが本文と食い違う場合は後のコメントを優先する。スコープの縮小や追加要件はコメントに書かれることが多いため。各条件について、満たされたと言える観察可能な証拠（ファイルの存在、テストの成否、API の挙動）を決めておく。

## 4. コードと照合して判定する

各条件について、コード・`git log` / `git blame`・テストの実行結果から証拠を集め、`path/to/file.ts:42` やコマンド出力として記録する。証拠が見つからない条件は満たされていないものとして扱い、「たぶん完了」とは判定しない。

判定は次の 5 つから選ぶ。

- `resolved`: すべての必須条件が証拠付きで満たされている
- `partially-resolved`: 一部だけ満たされている
- `unresolved`: まだ対応するコードがない、または症状が再現する
- `not-verifiable`: Issue の記述からは確認できない
- `obsolete`: スコープの削除や置き換えで、もう当てはまらない

## 5. 結果を示して承認を取る

判定ごとの更新案を作り、日本語の要約（判定、条件ごとの状態と証拠、残作業）とあわせて `AskUserQuestion` で承認を取る。一括モードでは一覧で示し、すべて実行 / close だけ個別に確認 / Issue ごとに修正 / 除外 / 何もしない を選ばせる。

- `resolved`: 証拠付きのコメントを投稿し、`completed` で close
- `partially-resolved`: 残作業を列挙したコメントを投稿し、open のまま
- `unresolved`: 状況のコメントを投稿し、open のまま（必要なら `confirmed` ラベル）
- `not-verifiable`: 再現情報を求めるコメントを投稿し、open のまま（必要なら `needs-repro` ラベル）
- `obsolete`: 理由のコメントを投稿し、`not_planned` で close

コメントは英語で 2,500 文字以内にし、この session を見ていない人にも分かるよう自己完結させる。冒頭に `git rev-parse --short HEAD` のコミット SHA を書く。根拠はコード引用ではなくパーマリンク（`https://github.com/<o>/<r>/blob/<sha>/<path>#L<line>`）で示す。末尾にマーカー `<!-- posted by github-workflow:issue-review -->` を入れる。

## 6. 承認された分だけ適用する

```bash
${CLAUDE_SKILL_DIR}/scripts/update-issue-status.ts <number-or-url> \
  --comment-file <コメントを書いた一時ファイル> \
  [--add-label <a,b>] [--remove-label <a,b>] \
  [--close --state-reason completed|not_planned] [--reopen]
```

指定したフラグの操作だけを行い、付いていないラベルの削除はスキップして、結果の状態・ラベル・コメント URL を JSON で返す。トークンは `GITHUB_TOKEN`、なければ `gh auth token` を使う。

最後に、Issue ごとの判定・行った操作・コメント URL と、除外した Issue と理由を報告する。
