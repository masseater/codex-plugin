---
name: gh-projects:epic-story-task
description: EPIC - Story - Task の3階層と依存関係で GitHub Projects を運用するための方法論。Use when the user asks to "set up EPIC story task workflow", "design issue hierarchy", "configure project for EPIC story task", "EPIC Story Task で運用したい", "issue 階層を設計", "GitHub Project を立ち上げ", or wants conceptual guidance on this issue-management pattern.
---

# EPIC - Story - Task 方法論

GitHub Projects + Issue（sub-issue / blocked-by）で 3階層 + 依存関係を運用するための汎用パターン。

具体的な CLI 操作は `cli` skill、対話的なワークフローは `create-epic` / `decompose-epic` / `plan-dependencies` / `review-progress` skill を参照する。

大原則として、段階的に進めるための粒度分割はしない。全体を作成してリリースする Story と、リリース後に各機能が意図どおり実装されているかを確認する Story を、EPIC 分解時点で確定する。

## 階層の定義

- EPIC — プロダクト/プロジェクトレベルの目標
- Story — EPIC を実現する成果単位。「全体リリース Story」と「機能別 検証 Story」の2種を EPIC 分解時点で確定する
- Task — Story を実装するための作業分解（任意）

Story の2種類:

- 全体リリース Story — EPIC が目指す全体を、意図どおりの完成物として一度に作り切り、完全にリリースする。段階的なフェーズには割らない
- 機能別 検証 Story — リリース後、機能ごとに「意図したものが実装されているか」を確認する。相違が見つかったときだけ修正する、最悪をキャッチするための保険。修正なしで確認を終えられるのが理想。close はせず、確認後は status を Need Review にする

判断基準（作業時間・規模は判断軸にしない）:

- 作業時間や規模で割らない — 「大きいから分割する」「小さいからまとめる」はしない。所要時間やボリュームを Story / Task の分け方の根拠にしない
- 意味の単位が違う（ユーザー価値の単位 vs 実装単位）→ レベルの誤りを疑う
- フェーズ分けしている（機能 A, 機能 B で全体リリース Story を分けている）→ フェーズ分割をやめて単一の全体リリース Story に統合する

## Story 分解の原則（分離粒度）

段階的に小さく進めるための分割はしない。EPIC 分解時点で「全体リリース Story（1つ）」と「機能別 検証 Story（機能ごと）」を確定し、以降この2種以外に Story を増やさない。

- 全体リリース Story で完璧に作り切る — first Story の時点で意図どおりの完成物を作り、完全にリリースされている状態にする。後の Story で足す前提の半完成品にしない
- 検証 Story は最悪をキャッチする保険 — リリース後、機能ごとに意図したものが実装されているかを確認し、相違があるときだけ修正する。機能追加や改善の置き場ではない
- 修正が発生しないのが最良 — first Story が完璧なら検証 Story は確認だけで終わる。修正は前提でも目標でもない
- 検証 Story は close せず Need Review にする — 確認が済んだら close ではなく status を Need Review に設定する
- 確認の記録を Story に残す — 実施した確認手順とその根拠（スクリーンショット / ログ / 実機確認など）を検証 Story にコメントする。確認が完了していなくても、根拠のコメントは随時残す。body 末尾の「確認の記録」をテンプレとして使う

なぜ段階的分割を避けるか:

- 半完成の Story を積み上げると、どの時点で「完璧にリリースできる完成物」になるかが曖昧になる
- 「後の Story で直す」前提のコードは完成基準が下がり、品質が劣化しやすい
- 段階を増やすほど「意図どおりに実装されているか」を確認する起点がぼやける

## Issue body の書き方

EPIC / Story の body には「達成したいこと（目的）」だけを明確に書く。目的が一義に伝われば十分。

- 書く: 目的、達成したい状態、成功の判断基準
- 書かない: 具体的な実装方法・設計詳細・完成形のコード（実装は body に固定しない）
- 書かない: 子（Story / Task）のリンク一覧（依存関係の SSoT は sub-issue（parent）と blocked-by）

### 例

EPIC の body（目的だけを書く）:

```md
## 目的

ユーザーがログインで迷わず、最短でサービスを使い始められる状態にする。

## 達成したい状態

- 初回ユーザーが説明なしにログイン手段を選べる
- ログイン失敗時に、次に何をすればよいか分かる

## 成功の判断基準

- ログイン完了率が改善する
- ログイン関連の問い合わせが減る
```

全体リリース Story の body（作り切る範囲の目的）:

```md
## 目的

ログイン画面で利用可能な手段を一目で選べ、失敗時の次の行動が分かるようにする。

## 達成したい状態

- 提供中のログイン手段が画面上で判別できる
- 認証失敗・入力エラー時に、原因と次の操作が示される
- 主要なブラウザ / デバイスで同じ体験になる
```

機能別 検証 Story の body（意図どおり実装されているかの確認）:

```md
## 確認したいこと（機能: ログイン手段の表示）

リリースした「ログイン手段の表示」が意図どおり実装されているかを確認する。

## 確認観点

- ログイン画面に「メールアドレス」「Google」「Apple」の 3 手段が、この順で表示される
- Apple ログイン非対応の環境では Apple だけ非表示になり、残り 2 手段は表示される
- 有効な手段が 1 つだけの設定のとき、そのボタンが中央に 1 つだけ表示される
- モバイル幅（375px）で 3 手段が横に潰れず縦並びで表示される

## 相違があった場合

例:「Apple ログインが iOS でも表示されない」「並び順が Google → メールになっている」などのズレを修正する。ズレが無ければ修正は不要。

## 確認の記録（完了前でもコメントする）

確認した内容は、完了していなくても都度この Story にコメントで残す。「実施した確認手順」と「意図どおり / 相違ありと判断した根拠」を、スクリーンショット / ログ / 実機確認の結果など第三者が再確認できる形で書く。確認が一通り済んだら close せず、status を Need Review に設定する。
```

❌ 悪い例（実装方法・コード・子リンクを body に書いている）:

```md
## 実装方法

- `LoginButtons.tsx` を新規作成し、`providers.map()` でボタンを描画
- 失敗時は `try/catch` で `setError(e.message)` を呼ぶ

## 子 Story

- #12 ログインボタン実装
- #13 エラー表示実装
```

## GitHub 機能との対応

- EPIC ↔ Story — Issue の Sub-issue で親子関係
- Story ↔ Task — Issue の Sub-issue で親子関係
- 並行 Story 間の前後関係 — Issue の Blocked by / Blocking
- Task の前提 Task — Issue の Blocked by / Blocking
- 全体可視化 — GitHub Project (v2) に EPIC / Story / Task を全て登録

ポイント:

- 親子関係は階層の表現に使い、横方向の依存（並行で進む別系統）には blocked-by を使う
- 機能別 検証 Story は全体リリース Story の blocked-by にする（リリース後に確認するため）
- 依存関係の Single Source of Truth は sub-issue（parent）と blocked-by。body ではなく Issue の関係として持つ（→「Issue body の書き方」）

## 運用ワークフロー（典型）

1. EPIC 起票 — 目的、成功指標、対象ユーザーを書く
2. Story 確定（EPIC 分解） — この時点で「全体リリース Story（1つ）」と「機能別 検証 Story（機能ごと）」を一括で起票する。段階的フェーズには割らない
3. 依存関係マッピング — 機能別 検証 Story を全体リリース Story の blocked-by にする。並行不可能な作業にも blocked-by を設定
4. Project に登録 — EPIC / Story / Task すべてを同じ Project に追加
5. 進捗確認 — `deps:show` や Project の Status グルーピングで棚卸し

Story / EPIC とも、作業・確認が済んだら status は Need Review までにとどめる。実際の close は人間が行い、自動ではクローズしない。

ステップごとの対話フローは個別 skill を参照。

## アンチパターン

- ❌ EPIC を Task の集合だけで構成する — Story の中間層が無いと「ユーザー価値の単位」での進捗が見えなくなる
- ❌ sub-issue だけで依存を表現する — 並列で進められる作業を親子に押し込めると、並行性が損なわれる
- ❌ 親の状態を子と切り離す — 親 Issue（EPIC / Story）は子が全部 Need Review 以降になってから Need Review にする。子が残ったまま親を先に進めると tracking が崩れる。実際の close は人間が行う
- ❌ EPIC を実装単位で切る — 「認証実装」のような実装視点は Story に降ろし、EPIC は「ログイン体験の向上」のように成果視点で書く
- ❌ 全体リリース Story を段階的な積み上げで切る — 「まず最小限 → 後の Story で機能追加」という incremental な分割は、完璧な完成物のリリースを遅らせる。全体を一度に作り切る
- ❌ 検証 Story を機能追加・改善の置き場にする — 検証 Story は意図と実装の相違を直すためのもの。新機能や追加要望を詰め込まない
- ❌ 親 Issue の本文に子をリンク列挙する — EPIC に子 Story、Story に子 Task を本文へ並べない。sub-issue（parent）と blocked-by が依存関係の SSoT。本文のリンク一覧は二重管理になり、Issue 操作と乖離する
- ❌ EPIC / Story の body に実装方法・コードを書く — body は達成したい目的を書く場所。実装方法・設計詳細・完成形コードを固定すると、目的と手段が混ざり実装の自由度を奪う

## Related Skills

- `cli` — 具体的な CLI コマンド
- `create-epic` — EPIC 起票の対話フロー
- `decompose-epic` — EPIC → Story → Task 分解の対話フロー
- `plan-dependencies` — 依存関係設計の対話フロー
- `review-progress` — 進捗棚卸しの対話フロー
