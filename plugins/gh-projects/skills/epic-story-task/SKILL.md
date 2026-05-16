---
name: epic-story-task
description: EPIC - Story - Task の3階層と依存関係で GitHub Projects を運用するための方法論。Use when the user asks to "set up EPIC story task workflow", "design issue hierarchy", "configure project for EPIC story task", "EPIC Story Task で運用したい", "issue 階層を設計", "GitHub Project を立ち上げ", or wants conceptual guidance on this issue-management pattern.
---

# EPIC - Story - Task 方法論

GitHub Projects + Issue（sub-issue / blocked-by）で 3階層 + 依存関係を運用するための汎用パターン。

具体的な CLI 操作は `cli` skill、対話的なワークフローは `create-epic` / `decompose-epic` / `plan-dependencies` / `review-progress` skill を参照する。

## 階層の定義

| Level     | 役割                                      | 粒度         | クローズ条件              |
| --------- | ----------------------------------------- | ------------ | ------------------------- |
| **EPIC**  | プロダクト/プロジェクトレベルの目標       | 数週〜数ヶ月 | 全ての子 Story がクローズ |
| **Story** | ユーザー/関係者にとって意味のある成果単位 | 数日〜2週間  | 全ての子 Task がクローズ  |
| **Task**  | 単独で完了判定できる作業単位              | 数時間〜数日 | 実装完了 + レビュー完了   |

判断基準:

- **粒度が大きすぎる**（2週間以上掛かる Task、数ヶ月の Story など）→ 一段下に分解
- **粒度が小さすぎる**（1時間の EPIC、10分の Story）→ 一段上にまとめ、もしくは Task のチェックリスト化
- **意味の単位が違う**（ユーザー価値の単位 vs 実装単位）→ レベルの誤りを疑う

## GitHub 機能との対応

| 階層                    | GitHub 上の表現                                           |
| ----------------------- | --------------------------------------------------------- |
| EPIC ↔ Story            | Issue の **Sub-issue** で親子関係                         |
| Story ↔ Task            | Issue の **Sub-issue** で親子関係                         |
| 並行 Story 間の前後関係 | Issue の **Blocked by / Blocking**                        |
| Task の前提 Task        | Issue の **Blocked by / Blocking**                        |
| 全体可視化              | **GitHub Project (v2)** に EPIC / Story / Task を全て登録 |

ポイント:

- 親子関係は階層の表現に使い、横方向の依存（並行で進む別系統）には blocked-by を使う
- 「sub-issue」は1つの親しか持てない。複数の EPIC にまたがる Story が必要な場合は、Story を独立させて blocked-by で繋ぐ

## Issue Type の使い分け（Issue Types が有効な場合）

Organization で Issue Types を有効化していれば、Issue 自体に `EPIC`, `Story`, `Task`, `Bug` などのタイプを付けられる。

- **Issue Types が使える**: Type を3階層に対応させ、Project の Filter / Group を Type で切る
- **Issue Types が使えない**: ラベル（`type:epic`, `type:story`, `type:task`）で代用する

skill の汎用例ではラベル / Type のどちらでも動くように `<type-marker>` という抽象で示す。

## Project Field の推奨セット

Project には最低限以下の Field を用意する（命名は環境に合わせて変えて良い）:

| Field         | Type                            | 用途                                  |
| ------------- | ------------------------------- | ------------------------------------- |
| **Status**    | Single select                   | Todo / In Progress / In Review / Done |
| **Type**      | Single select または Issue Type | EPIC / Story / Task                   |
| **Priority**  | Single select                   | P0 / P1 / P2                          |
| **Iteration** | Iteration                       | 週次 or 2週間スプリント（任意）       |
| **Estimate**  | Number                          | Story point or 日数（任意）           |

Field を増やしすぎると運用負荷が上がる。必須なのは Status と Type の2つ。

## 運用ワークフロー（典型）

1. **EPIC 起票** — 目的、成功指標、対象ユーザー、概算ボリュームを書く
2. **Story 分解** — EPIC を、ユーザーや関係者が個別に評価できる単位に切る
3. **Task 分解** — 実装可能な粒度まで Story を割る（必要なら）
4. **依存関係マッピング** — 並行不可能な Story / Task に blocked-by を設定
5. **Project に登録** — EPIC / Story / Task すべてを同じ Project に追加
6. **進捗確認** — `deps:show` や Project の Status グルーピングで棚卸し

ステップごとの対話フローは個別 skill を参照。

## アンチパターン

- ❌ **EPIC を Task の集合だけで構成する** — Story の中間層が無いと「ユーザー価値の単位」での進捗が見えなくなる
- ❌ **sub-issue だけで依存を表現する** — 並列で進められる作業を親子に押し込めると、並行性が損なわれる
- ❌ **Field を毎プロジェクト変える** — 横串の集計ができなくなる。Org 全体で共通の Status / Type を決めるのが望ましい
- ❌ **クローズ条件を子の状態と切り離す** — 親 Issue は子が全部クローズした時点でクローズする。子が残ったまま親をクローズすると tracking が崩れる
- ❌ **EPIC を実装単位で切る** — 「認証実装」のような実装視点は Story に降ろし、EPIC は「ログイン体験の改善」のように成果視点で書く

## レポジトリ移植時のチェックリスト

新規リポジトリで本パターンを始める前に確認:

- [ ] `gh auth refresh -s project` を実行済みか
- [ ] Org で Issue Types を使うか、ラベルで代用するかを決定
- [ ] Project を Org 直下に作るか、repo に link するかを決定（複数 repo 横断なら Org 直下）
- [ ] Status / Type 以外の必要な Field を定義
- [ ] EPIC の Issue Template を用意（任意。ただし `<owner>/<repo>/.github/ISSUE_TEMPLATE/` の運用は本プラグインスコープ外）
- [ ] チーム内で「EPIC をクローズする条件」「Story の粒度」を合意

## Related Skills

- `cli` — 具体的な CLI コマンド
- `create-epic` — EPIC 起票の対話フロー
- `decompose-epic` — EPIC → Story → Task 分解の対話フロー
- `plan-dependencies` — 依存関係設計の対話フロー
- `review-progress` — 進捗棚卸しの対話フロー
