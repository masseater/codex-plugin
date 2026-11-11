---
name: epic-review
description: EPIC 配下の Story / Task を sub-issue・blocked-by・Project の Status から棚卸しする。着手可能・ブロック中・滞留・Need Review に分類し、次のアクションを提案する。棚卸しは読み取りだけで行い、Status などの変更は承認を得てから別途実行する。「EPIC の進捗を確認して」「次に何をやるか教えて」「ブロッカーを確認して」と頼まれたときに使う。
---

# EPIC Review

CLI は `../../scripts/gh-project.ts`（以下 `gh-project.ts`）。コマンドが失敗したら `../cli/SKILL.md` の「落とし穴」を読む。入力は `<owner>/<repo>` と EPIC 番号、Status を見る場合は Project の owner と番号。

棚卸しは読み取りだけで行う。コメント・assignee・Status の変更は提案にとどめ、ユーザーが承認したものだけ別途実行する。

## 手順

1. `gh-project.ts deps:show <owner>/<repo> <epic#>` で子 Story、完了率、blocked-by / blocking を取る。各 Story にも `deps:show` を実行して Task を集める
2. Status を見る場合は `gh-project.ts item:list <owner> <project#>` の出力と Issue 番号で突き合わせる
3. open の Issue を分類する
   - Ready: blocked-by がすべて完了相当（Need Review 以降か closed）
   - Blocked: 完了相当でない blocked-by がある
   - In Progress: Status が In Progress
   - Stale: In Progress のまま長く更新がない（どれくらいを長いとするかは EPIC の時間軸で判断する）
   - Need Review: Status が Need Review。作業・確認は済み、人間の close 待ち
   - Done: closed
4. 報告する。進捗は Need Review 以降を完了相当として数える（検証 Story は close せず Need Review で止まるため）

   ```markdown
   ## EPIC #<n>: <title>

   進捗: <Need Review 以降>/<全 Story> Story が完了相当（<percent>%）、うち closed <n>

   ### Ready（<件数>）

   - #<n> <title> — assignee: <user | ->

   ### Blocked（<件数>）

   - #<n> <title> — blocked by #<m>（<title>、status: <status>）

   <In Progress / Stale / Need Review / Done も同じ形式で、0 件の区分は省く>

   ## 次のアクション

   1. <次に着手を勧めるもの>
   2. <ブロッカー解除の提案>
   ```

## 提案の目安

- Blocked が Ready より多い: 依存の張りすぎを疑い、`/gh-projects:epic-plan` の 4 で依存を見直すよう提案する
- Stale が 3 件以上: assignee や優先度の見直しを提案する
- Need Review が溜まっている: 人間の close（受け入れ判断）が滞っているので、レビュー担当への確認を提案する
- 段階的な実装 Story が増えている、または検証 Story が機能数より少ない: `epic-story-task` の分け方から外れているので指摘する
- 確認済みで Status が Need Review でない Story: 承認を得て `gh-project.ts status:set <owner> <project#> <issue-url> "Need Review"` で設定する

## 制約

`deps:show` は sub-issue を 50 件、blocked-by を 20 件までしか取らない。超える EPIC では `gh api graphql` でページネーションして取得する。
