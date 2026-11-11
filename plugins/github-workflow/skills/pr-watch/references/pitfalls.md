# PR 監視の落とし穴

監視ループの判定を黙って誤らせる GitHub の挙動。判定に迷ったら該当節を読む。

## conflict 中は pull_request の GHA が dispatch されない

`mergeStateStatus` が `DIRTY` の PR では merge ref を作れないため、`pull_request` トリガーの workflow は起動せず `gh pr checks` にも現れない。CI を待つ前に conflict を確認する。例外は次の 3 つで、これらは conflict 中でも結果が届く。

- `pull_request_target` トリガー（base 側で動く）
- 外部連携（Vercel、CodeRabbit など。head commit に対して動く）
- `push` トリガーの workflow（head commit で動くが、merge 後の状態は検証しない）

## CI 実行中に base が進む

CI の実行中に他の PR が base に merge されると、新しい conflict や behind が生じ、CI 結果が無効になる。CI 完了後にも `mergeStateStatus` を取り直す。

## mergeable が null になる

mergeability は非同期に計算されるので、push 直後の `gh pr view` は `mergeable: null` を返しやすい。2 秒間隔で 3 回まで取り直し、それでも null ならループ先頭に戻って次の周回で判定する。

## mergeStateStatus の値

- `CLEAN`: merge 可能で commit status も成功。レビュー状態は含まないので `reviewDecision` を別に見る
- `DIRTY`: conflict あり
- `BLOCKED`: branch protection を満たしていない（必須レビュー、必須 check の未完了・失敗、merge queue 待ち）
- `UNSTABLE`: merge 可能だが必須でない check が失敗している。必須 check が失敗していれば `BLOCKED` になる
- `BEHIND`: base より古い。「最新の base を要求」設定があると merge できない
- `UNKNOWN`: GitHub が未計算。conflict / behind ではないものとして CI の確認に進む
- `HAS_HOOKS`: 主に GHES で見られる非公式の値。`CLEAN` と同等に扱う

## merge queue 中の BLOCKED は正常

merge queue を使うリポジトリでは、queue 内の PR が `BLOCKED` になる。queue 内の CI は `gh pr checks` に出ないことがあるので、`BLOCKED` を即エラーと判定しない。GraphQL の `PullRequest.mergeQueueEntry` で queue 投入済みかを確認する。

## dismissed review と reviewDecision の遅れ

push で既存の approve が dismiss されうる。`reviewDecision` は個々のレビュー状態に遅れて追従する。approve 済みに見えても、最新のレビューが `DISMISSED` なら再承認を要する。CODEOWNERS で割り当てたレビュアーは `reviewRequests` に出ないことがあるので、人数を数えず `reviewDecision` を正とする。

## Checks API と Statuses API は別物

`checks.listForRef` は Checks API の結果だけを、`repos.getCombinedStatusForRef` は Statuses API の結果だけを返す。`get-ci-status.ts` は Checks API だけを見るので、外部サービスが commit status で報告するリポジトリでは `gh pr checks` も併せて見る。GraphQL の `statusCheckRollup` は両方を集約するが、rollup 自体が `null`（check が一度も走っていない）や `EXPECTED`（外部サービスの報告待ち）は成功扱いにしない。

## 件数の上限で黙って切り詰められる

- `gh pr list` は既定で 30 件まで。`--limit 100` を付ける
- check runs の API は既定で 1 ページ 30 件。大きな matrix では取りこぼす。`get-ci-status.ts` と `get-ci-logs.ts` は `per_page: 100` で取るが、100 件を超える check は取りこぼすので `gh pr checks` も併せて見る

## merge 後の head branch 削除

merge 時に head branch が削除されると、head SHA を参照する API が 404 を返す。`state` が `MERGED` なら 404 を完了として扱う。

## draft PR は CI が通っても merge できない

draft でも CI と branch protection は評価されるが、merge は常にブロックされる。CI が緑でも `isDraft` を確認する。

## CI が queued のまま始まらない

全 job が queued のまま進まない場合、Renovate などが大量の PR を同時に作って Actions の並列実行枠が埋まっていることがある。

```bash
gh run list --limit 15 --json databaseId,headBranch,status,workflowName
```

queued が 5 件を超えていて大半が他ブランチのものなら、その一覧をユーザーに示し、他ブランチの run を cancel してよいか確認してから `gh run cancel <id>` する。他人の PR の CI を止めることになるため、承認なしでは cancel しない。queued が少ないなら githubstatus.com で障害を確認する。
