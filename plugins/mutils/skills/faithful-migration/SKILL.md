---
name: mutils:faithful-migration
description: "This skill should be used when the user asks to 'port a feature from repo A to repo B', 'migrate a repository feature faithfully', 'rewrite faithfully', 'fork-and-customize without dropping flows', 'リポジトリ間移植', '別リポジトリの機能を移植', '忠実に移植', 'A の機能を B にそのまま持ってきて', or wants to port / rewrite / re-implement an existing repository's feature set into another codebase without silently shrinking scope. It forces 1:1 enumeration, source/target architecture diagrams reviewed by the consecutive-review-loop skill, a shrink-vocabulary ban, one-outcome-per-PR, and a pre-merge local verification with screenshots."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls *), Bash(find *), Bash(rg *), Bash(git status), Bash(git diff *), Bash(git log *), Bash(gh issue *), Bash(gh pr *), Agent, TodoWrite, AskUserQuestion
---

# faithful-migration

リポジトリ A の機能をリポジトリ B に「本当にそのまま」移植・リライト・フォーク後カスタマイズするためのオーケストレータスキル。AI が縮小再生産（完了判定のすり替え / subset 対応 / 検証先送り）で逃げないように、列挙・構成図・語彙制約・PR 構造・検証ステップを構造的に強制する。

`$ARGUMENTS`

## いつ起動するか

- IF: ユーザーがリポジトリ A の機能をリポジトリ B に「移植 / リライト / 持ってくる / フォーク後カスタマイズ」する作業を依頼した; THEN MUST: 本スキルを起動する
- IF: 既存実装の「忠実な再現」「1:1 再実装」「ユーザー操作の網羅的なパリティ」が要件である; THEN MUST: 本スキルを起動する
- IF: スキル本体の Phase が完了する前にユーザーが完了宣言を求めてきた; THEN MUST: 残フェーズと残作業を明示してから判断を仰ぐ

## 縮小再生産の禁止

このスキルが防ぐ失敗モード（観測実績あり）:

1. 完了判定が機能カテゴリ網羅（骨格 / domain / api / web）にすり替わり、個別 UI フローの 1:1 性は完了条件から外れる
2. 個別 UI フローの突合を「mock 除去」「実フロー接続」の文言で済ます
3. 設計変更を要する部分を `(編集モード)のみ対応` のような subset 宣言で逃げる
4. 突合スコープを自分で恣意的に縛り「忠実な移植を確認した」と宣言する
5. 動作検証を「merge 後にローカルで確認」と先送りする

これら全てを Phase 5 の禁止語彙 + Phase 7 の merge 前検証 + Phase 2 の全列挙で構造的に塞ぐ。

## 完了条件（着手前に固定する）

- MUST: 着手前にユーザーが手元で通す **具体的な 1 周フロー** を outcome として宣言する。例: 「ユーザーが新規作成 wizard を開き、3 ステップ入力して保存し、一覧で行が確認できる」
- MUST NOT: 「子 Story 全実装」「mock 除去完了」「主要画面突合済み」のような中間 KPI で完了宣言する
- MUST: outcome は **1 PR につき 1 つ** に絞る（Phase 6 を参照）
- MUST: outcome 宣言文を `.agents/workspaces/[workspace-id]/000000-outcome.md` に保存する

## 依存スキル

本スキルは以下のスキルを **呼び出す側** として動作する。

| スキル                           | 用途                                         |
| -------------------------------- | -------------------------------------------- |
| `workspace-id`                   | 作業ディレクトリ規約に基づく workspace 生成  |
| `diagram-render:draw-diagram`    | 移植元 / 移植先システム構成図の Mermaid 作成 |
| `diagram-render:render`          | 構成図 Markdown を HTML へ変換               |
| `mutils:consecutive-review-loop` | 構成図の精度を N 回連続レビューで担保する    |

## 成果物ディレクトリ

workspace-id スキルで生成された `.agents/workspaces/[workspace-id]/` 配下に以下を統一保存する。

| ファイル / ディレクトリ           | 内容                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `000000-outcome.md`               | 着手前に宣言した 1 周フロー outcome                                            |
| `000001-enumeration.md`           | 移植元の全画面 + 全 API endpoint 列挙表、移植先対応 path と 1:1 diff（3 列表） |
| `000002-source-diagram.md`        | 移植元の **完璧な** システム構成図（Mermaid）                                  |
| `000002-source-diagram.html`      | 同 HTML（`diagram-render:render` で生成）                                      |
| `000003-target-diagram.md`        | `000002` を移植先リポジトリの規約に基づいて再構成した版（Mermaid）             |
| `000003-target-diagram.html`      | 同 HTML                                                                        |
| `000004-pr-bodies/`               | outcome 単位の PR 本文ドラフト（1 PR = 1 outcome）                             |
| `000005-screenshots/[flow-name]/` | merge 前必須の 1 周フロースクリーンショット                                    |

## Phase 1: Workspace Bootstrap

- MUST: `workspace-id` スキルを呼び出し、`feature-name` を `faithful-migration-[short-feature-tag]` 形式で生成する
- MUST: 生成された workspace ディレクトリ配下に上記成果物を保存する
- MUST NOT: ad-hoc な作業ディレクトリ（`/tmp` / リポジトリ直下 / 別 PR の workspace）に成果物を置く

```text
ws_id = invoke("workspace-id", feature_name = "faithful-migration-" + short_tag)
ensure_dir(".agents/workspaces/" + ws_id)
```

## Phase 2: 全列挙（Enumeration）

移植元の **全画面 + 全 API endpoint** を列挙し、移植先の対応 path と 1:1 で差分を出す。

- MUST: `000001-enumeration.md` に下記 3 列表を書く
- MUST: すべての行に `parity status` を埋める。`TBD` 行を 1 行も残してはならない
- MUST NOT: 「主要画面のみ突合」「サンプリングして突合」のような恣意的縮小を許容する
- IF: 移植先に対応 path がない; THEN MUST: `parity status: missing` と書き、補完計画を Phase 6 の PR 本文に紐付ける
- IF: 挙動差がある; THEN MUST: `parity status: behavior-diff` と書き、具体的な差分を 1 行で添える

### 列挙表テンプレ

```markdown
# 000001 Enumeration

source repo: <org/repo@sha>
target repo: <org/repo@sha>
enumerated by: <session id / agent>
enumerated at: <yyyy-mm-dd HH:MM>

| source path             | target path             | parity status                                            |
| ----------------------- | ----------------------- | -------------------------------------------------------- |
| `/users/new` (UI)       | `/admin/users/new`      | 1:1                                                      |
| `POST /api/users` (API) | `POST /admin/api/users` | behavior-diff: 画像アップロードが別 API に分割されている |
| `/users/:id/edit` (UI)  | (none)                  | missing                                                  |
```

### 列挙ルール（疑似コード）

```text
rows = []
for path in walk_source_routes(source_repo):
    target = lookup_target_path(path)
    rows.append({source: path, target: target, status: classify(path, target)})
for endpoint in walk_source_api(source_repo):
    target = lookup_target_endpoint(endpoint)
    rows.append({source: endpoint, target: target, status: classify(endpoint, target)})

assert every row has status in {"1:1", "missing", "behavior-diff"}
assert no row has status == "TBD"
write rows to 000001-enumeration.md
```

## Phase 3: 移植元の完璧なシステム構成図

移植元リポジトリの構造を Mermaid で完全に表現し、`consecutive-review-loop` で精度を担保する。

- MUST: `diagram-render:draw-diagram` で `000002-source-diagram.md` を作成する
- MUST: `diagram-render:render` で `000002-source-diagram.html` を生成する
- MUST: `mutils:consecutive-review-loop` を `N = 3` で呼び出し、独立な subagent 3 回連続 PASS まで反復する
- MUST: レビュー subagent は `sonnet` 指定、flat prompt（過去フィードバック非伝達）で起動する
- MUST: 失敗時の streak リセットは consecutive-review-loop の仕様（FULL RESET = streak を 0 に戻す）に従う
- MUST: 修正は本エージェント（メインエージェント）が `Edit` / `Write` で直接行う。修正をサブエージェントに委譲してはならない
- MUST: 修正のたびに `000002-source-diagram.html` を再レンダリングする

### レビュー pass 条件

レビュー subagent は以下を判定する:

> Pass iff every flow / API listed in `000001-enumeration.md` is represented in `000002-source-diagram.md` as a node, and every interaction between them is represented as an edge with the correct direction.

### 疑似コード

```text
write 000002-source-diagram.md via draw-diagram
render 000002-source-diagram.html

flatPrompt := buildFlatPrompt(
    target = "000002-source-diagram.md",
    focus  = "全画面/全 API が enumeration の通りにノード化され、関係がエッジで表現されているか"
)

streak = 0
attempts = 0
while streak < 3:
    attempts += 1
    result = spawnSubagent(prompt = flatPrompt, model = "sonnet")
    if result == PASS:
        streak += 1
    else:
        streak = 0   # full reset
        for finding in result.findings:
            main_agent_edit(000002-source-diagram.md, finding)
        re_render(000002-source-diagram.html)
```

## Phase 4: 移植先規約での再構成図

`000002` をベースに、移植先リポジトリの命名・レイヤ・FSD などの規約に従って再構成した版を保存する。

- MUST: 移植先リポジトリの `AGENTS.md` / `README.md` / レイアウト規約 / 命名規約 / レイヤ規約を読む
- MUST: `000002-source-diagram.md` をコピーして `000003-target-diagram.md` を作る
- MUST: ノード名 / サブグラフ / レイヤ構造を移植先規約に揃える
- MUST NOT: ノードを **silent に省略** する。省略する場合は `000001-enumeration.md` の `parity status: missing` と一致していること
- MUST: `000003-target-diagram.html` を再レンダリングする
- MUST: `consecutive-review-loop` を `N = 3` で再度呼び出す（別の flat prompt）

### レビュー pass 条件（target 用）

> Pass iff (a) every node from `000002-source-diagram.md` is represented in `000003-target-diagram.md` (no silent omission; explicit `missing` annotations are allowed and must match `000001-enumeration.md`), AND (b) layout / naming / layer follows the target repo conventions documented in its `AGENTS.md` / layout rules.

### 疑似コード

```text
target_conventions := read_target_conventions(target_repo)
copy 000002-source-diagram.md -> 000003-target-diagram.md
rename_nodes_per(target_conventions)
re_render 000003-target-diagram.html

flatPrompt := buildFlatPrompt(
    target = "000003-target-diagram.md",
    focus  = "(a) 000002 のノード網羅 + (b) 移植先規約への適合"
)

streak = 0
while streak < 3:
    result = spawnSubagent(prompt = flatPrompt, model = "sonnet")
    if result == PASS:
        streak += 1
    else:
        streak = 0
        for finding in result.findings:
            main_agent_edit(000003-target-diagram.md, finding)
        re_render(000003-target-diagram.html)
```

## Phase 5: 縮小語彙の禁止

縮小再生産を糊塗する語彙の使用を検出してブロックする。

### 禁止語リスト

| カテゴリ         | 語                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| 部分対応の糊塗   | `(編集モード)のみ対応`、`subset`、`部分対応`、`as-is`                                  |
| 完了に見せる骨格 | `骨格`、`walking skeleton`、`mock 除去`、`機能パリティ`                                |
| 検証先送り       | `後続 PR で対応`、`次の PR で`、`レビュー後にローカルで確認`、`merge 後にローカル確認` |

### 検出時の挙動（疑似コード）

```text
forbidden = ["(編集モード)のみ対応", "subset", "部分対応", "as-is",
             "骨格", "walking skeleton", "mock 除去", "機能パリティ",
             "後続 PR で対応", "次の PR で", "レビュー後にローカルで確認",
             "merge 後にローカル確認"]

function lintTextForShrinkVocab(text, contextHeading):
    for term in forbidden:
        if term in text:
            if contextHeading == "未対応の残作業":
                continue   # 明示残作業として宣言されているなら許容
            else:
                BLOCK and require: 該当行を「未対応の残作業」ヘディング配下に移すか削除するか選ばせる

on commit_message_drafted(msg):
    lintTextForShrinkVocab(msg, "commit body")

on pr_body_drafted(body):
    lintTextForShrinkVocab(body, "pr body")
```

- MUST: コミットメッセージドラフト / PR 本文ドラフトのすべてに対し上記 lint を実行する
- MUST NOT: `未対応の残作業` 見出し以外で禁止語を使う
- IF: 禁止語が `未対応の残作業` 見出し配下で使われている; THEN MAY: 通過させる（明示残作業として有効）

## Phase 6: 1 PR = 1 outcome

- MUST: 1 PR は **1 つの具体的な 1 周フロー outcome** だけを宣言する
- MUST: PR 本文の `## Outcome` 欄に「ユーザーが手元で [X] を 1 周通せる（screenshot 添付済み）」を書く
- MUST NOT: EPIC 全体を 1 PR にまとめる
- MUST NOT: 1 PR で複数 outcome を宣言する（複数あるなら PR を分割する）
- IF: スコープ内に複数 outcome が必要; THEN MUST: outcome ごとに PR を分け、Issue 側で sub-issue / blocked-by を引く（`gh-projects` の `epic-story-task` パターン参照）

### PR 本文テンプレ

`000004-pr-bodies/[outcome-slug].md` に保存し、PR 作成時にコピペする。

```markdown
## Outcome

ユーザーが手元で <具体的な 1 周フロー> をスクリーンショット付きで通せる。

## 突合スコープ

`000001-enumeration.md` の該当行（source path / target path / parity status）をそのまま引用する。

| source path | target path | parity status |
| ----------- | ----------- | ------------- |
| ...         | ...         | ...           |

## 検証スクリーンショット

- `000005-screenshots/<flow-name>/01-start.png`
- `000005-screenshots/<flow-name>/02-input.png`
- `000005-screenshots/<flow-name>/03-confirm.png`
- `000005-screenshots/<flow-name>/04-saved.png`

## 未対応の残作業

（subset 対応や設計差異がある場合のみ列挙する。空欄でもよい）

- ...

## Relates

Relates to #<issue>
```

## Phase 7: merge 前ローカル検証

- MUST: PR を open する **前に** ローカルで移植先アプリを起動し、Phase 6 で宣言した 1 周フローを実際に通す
- MUST: 各ステップのスクリーンショットを `000005-screenshots/[flow-name]/` に保存する
- MUST: スクリーンショットへの相対パスを PR 本文の `## 検証スクリーンショット` 欄に列挙する
- MUST NOT: 「merge 後にローカル確認」「業務フロー手動確認は本 PR では未実施」のような先送り宣言を PR 本文に含める
- IF: ローカルで詰む箇所が見つかった; THEN MUST: PR を open せずに修正してから再検証する

```text
before_open_pr(pr):
    assert local_app_running(target_repo)
    capture_screenshots(flow = pr.outcome, dir = "000005-screenshots/" + slug(pr.outcome))
    assert all_steps_passed_locally(flow)
    if not all_steps_passed_locally:
        BLOCK pr_open and fix
    inject_screenshot_paths_into(pr.body)
    lintTextForShrinkVocab(pr.body, "pr body")
    open_pr(pr)
```

## ルールサマリ

- IF: 着手前に outcome が宣言されていない; THEN MUST: Phase 0 に戻り outcome を `000000-outcome.md` に保存してから着手する
- IF: `000001-enumeration.md` に `TBD` 行が 1 行でも残っている; THEN MUST: Phase 2 を完了させてから次に進む
- IF: `000002` / `000003` の構成図に対する consecutive-review-loop が 3 連続 PASS に達していない; THEN MUST: PR を open しない
- IF: PR 本文 / コミットメッセージに禁止語が `未対応の残作業` 以外で出現している; THEN MUST: ブロックして書き換える
- IF: `000005-screenshots/[flow-name]/` が空 OR PR 本文に貼られていない; THEN MUST: PR を open しない
- MUST NOT: 1 PR に複数 outcome を載せる
- MUST NOT: 検証を merge 後に倒す
- MUST NOT: 構成図レビューをメインエージェント自身が行う（consecutive-review-loop の独立性が崩れる）
- MUST NOT: ノードを silent に省略する（`missing` 注記が必要）

## アンチパターン

| アンチパターン                                                  | なぜダメか                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 「骨格を全カテゴリ網羅したので完了」                            | 完了は outcome（1 周フロー）で定義する。カテゴリ網羅は中間 KPI に過ぎない    |
| 「主要画面 3 枚を突合したので忠実な移植を確認」                 | 突合スコープを恣意的に縛っている。Phase 2 で全列挙し全行に status を付ける   |
| 「(編集モード) のみ対応」と書いて完了とする                     | subset 宣言で逃げている。Phase 5 で禁止語として検出される                    |
| 「業務フロー手動確認は本 PR では未実施。merge 後に確認」        | 検証先送りは Phase 5 / Phase 7 でブロックされる                              |
| EPIC を 1 PR にまとめる                                         | 詰み UI が diff 量に埋もれる。Phase 6 で 1 PR = 1 outcome                    |
| 構成図レビューをメインエージェント自身が眺めて OK と判断        | 独立性が崩れる。consecutive-review-loop で flat prompt subagent を使う       |
| target diagram でノードを「移植先には無いから」と silent に削除 | `parity status: missing` を `000001` と一致させる形で残す。silent 省略は禁止 |
