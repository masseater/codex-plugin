---
name: figma-implement
description: Figma のプロトタイプをたどって画面一覧と遷移を洗い出し、画面ごとに実装・ビジュアルレビュー・仕様レビュー・修正をサブエージェントで回してフロー全体を実装する。Figma のプロトタイプ URL を渡されて「このフローを実装して」「Figma の画面を全部実装して」と頼まれたときに使う。1 画面だけなら公式 Figma plugin の implement-design で足りる。
argument-hint: "[flowName] [Figma URL]"
allowed-tools: Bash(ls *) Bash(echo *)
hooks:
  Stop:
    - hooks:
        - type: command
          command: "../../hooks/entry/notify-phase-status.ts"
---

# Figma フロー実装

親エージェントは全体の進行役になり、画面の実装とレビューはサブエージェントに任せる。画面ごとに文脈を切り離すことで、多数の画面を実装しても親のコンテキストが Figma データで埋まらないようにするため。1〜2 行で済む軽微な修正は親が直接行ってよい。

成果物はすべて `.agents/ui-dev/<flowName>/` に置く。

```text
.agents/ui-dev/<flowName>/
├── config.json
├── screen-map.md
├── prototype-chain.json
├── screenshots/            (trace が保存。パスは prototype-chain.json の frames[<id>].screenshot)
└── reports/
    ├── <screen>-implement.md
    ├── <screen>-visual-review.md
    ├── <screen>-code-review.md
    └── <screen>-fix-<N>.md
```

## 現在の状態

既存のフロー（`.agents/ui-dev` の一覧）は次のとおり。

```!
ls .agents/ui-dev 2>/dev/null || echo "なし"
```

依頼のフロー名（無ければ Figma URL）に当たるフローが既存のフローにあれば、その `config.json` と `reports/` を読み、準備を飛ばして画面ごとに再開する。引数の置換は自然文で呼ばれたときに働かないので、フローの特定はこの一覧と依頼内容から行う。既存のフローに対して準備をやり直すと config.json と prototype-chain.json を上書きしてしまうため、該当がなければ新規フローとして準備から始める。再開した画面の `fix_round` は既存の `<screen>-fix-<N>.md` の最大 N から始める（下の疑似コード）。

- `<screen>-implement.md` が無い → 実装から
- implement はあるがレビューが無い → レビューから
- 最大 N の `<screen>-fix-<N>.md` より更新時刻の新しいレビューが無い → fix-N を実装レポートとみなしてレビューから（レビューは同名で上書きされるので、前後関係は `ls -lt` の更新時刻で判定する）
- レビュー済みで修正が無い → 指摘の分類から

## 準備

screen map で不明な項目に付ける未確認マーカーは `⚠️ Unconfirmed` である。

1. 引数からフロー名と Figma URL を取り、URL から fileKey と nodeId を取り出す。フロー名が無ければ Figma のページ名か開始フレーム名から kebab-case で決め、ユーザーに伝える
2. プロトタイプをたどり、全フレームのスクリーンショットを保存する。フレームが 1 つしか出なければ、開始ノードがページではなくフレームを指しているかユーザーに確認する

   ```bash
   ../figma-data/scripts/trace-prototype-chain.ts \
     --file-key <fileKey> --node-id <nodeId> \
     --output .agents/ui-dev/<flowName>/prototype-chain.json
   ```

3. 画面のつながりを次のコマンドで見ながら、[references/screen-map-template.md](references/screen-map-template.md) をもとに `screen-map.md` を作る。遷移・状態・バリデーションを埋め、不明な項目には未確認マーカーを付けてユーザーに確認する

   ```bash
   ../figma-data/scripts/query-prototype-chain.ts \
     --json-path .agents/ui-dev/<flowName>/prototype-chain.json --node-id map
   ```

   プロトタイプが無くページ単位で始めたいときは、次のコマンドで骨組みを作れる。

   ```bash
   ../../scripts/figma-scaffold.ts --url <URL> --page <page> --output <screen-map.md>
   ```

4. config.json を作る。`contextFiles`（レビューで参照するデザインシステムの文書など）と `reviewPrompts` はユーザーに追加を提案する

   ```json
   {
     "flow": {
       "name": "<flowName>",
       "currentPhase": "implement",
       "figma": {
         "fileKey": "<fileKey>",
         "prototypeChainPath": ".agents/ui-dev/<flowName>/prototype-chain.json"
       },
       "screens": ["<screen1>", "<screen2>"]
     },
     "contextFiles": [],
     "reviewPrompts": { "common": [], "visual": [], "code": [] }
   }
   ```

## 実装ループ

画面ごとに次を回す。途中でユーザーに確認を求めず、全画面を終えてからまとめて報告する。

```text
for screen in config.flow.screens:
  if reports/<screen>-implement.md does not exist:
    spawn figma-implementer(initial)        -> reports/<screen>-implement.md
  fix_round = max N of reports/<screen>-fix-<N>.md (0 if none)
  loop:
    spawn visual-reviewer and code-reviewer in parallel
    classify findings into A / B / C / D
    fixable = A/B findings except those with low severity and low confidence
    if fixable is empty: break               -> screen passes
    if fix_round >= 3:
      record remaining fixable findings as TODOs in the latest report; break
    fix_round += 1
    spawn figma-implementer(fix, fixable)   -> reports/<screen>-fix-<fix_round>.md
```

- サブエージェントは Agent ツールで `ui-dev:figma-implementer`、`ui-dev:visual-reviewer`、`ui-dev:code-reviewer` を起動する。入力と出力形式は各エージェント定義にある
- 結果はサブエージェントの返答文ではなくレポートファイルから読む。レポートが無ければ同じ指示で 1 回だけ再起動し、2 回続けて失敗したらユーザーに報告する
- 再レビューは同じファイル名（`<screen>-visual-review.md`、`<screen>-code-review.md`）を上書きする

## 指摘の分類

レビューの指摘は親が分類する。ユーザーには判断を求めない。

- A. コードで直せる（バグ、スタイルのずれ、実装漏れ）→ 修正する
- B. 仕様の穴（リトライ上限やタイムアウトが未定義など）→ 妥当な仮定を置いて修正し、仮定をレポートに書く
- C. デザインの変更が要る（Figma に無いエラー状態、実データでレイアウトが崩れるなど）→ コードに `// TODO(design):` を残し、screen map の該当箇所に未確認マーカーを付ける
- D. アーキテクチャの変更が要る（状態管理の見直し、API 呼び出しタイミングの変更など）→ レポートの「Unresolved TODOs」節に書く

severity と confidence がともに low の指摘は、A/B でも修正対象にせず記録だけにする。誤検知の可能性が高い指摘で修正ループを回さないため。

## 完了

全画面が終わったら config.json の `currentPhase` を `"done"` にし、次をまとめて報告する。

- 画面ごとの状態と修正の回数
- 残った TODO（C / D 別）
- B の修正で置いた仮定

デザイナーへのフィードバックや手動 QA のチェックリストを求められたら、[references/handoff.md](references/handoff.md) の形式で作る。

## 困ったとき

- trace が失敗する: `FIGMA_ACCESS_TOKEN` を確認する。node-id はコロン（`1:2`）とダッシュ（`1-2`）の両方を試す
- `get_design_context`（ツール名は figma-data skill を参照）が空を返す: node-id と、Figma 側で Ready for Dev になっているかを確認する
