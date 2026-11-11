---
name: draw-diagram
description: Mermaid を含む Markdown でアーキテクチャ図・システム構成図・フローチャート・シーケンス図・依存関係図・ER 図・状態遷移図を書き、図を埋め込んだ自己完結 HTML に変換する。「アーキテクチャ図を書いて」「処理の流れを図にして」のように閲覧用の図を頼まれたときに使う。既存の Mermaid 入り Markdown を HTML にしたいときにも使う。
---

# 図の作成と HTML 化

## 手順

1. 図の目的・登場要素・関係・強調点を確認する。足りなければユーザーに 1〜3 点だけ聞く
2. 下の判別基準でフロー系かアーキ系かを決め、図種を選ぶ。図種別のテンプレートと書き方は [references/diagram-types.md](references/diagram-types.md) にある
3. Markdown を書く。各図にタイトルと「この図で何を伝えるか」の 1 文を付け、色・形・線種に意味を持たせたなら凡例も書く。1 ファイルに複数の図を並べてよい
4. 構文を検査し、エラーがあれば直して再実行する: `${CLAUDE_SKILL_DIR}/scripts/render.ts <md> --validate-only`
5. HTML を生成する: `${CLAUDE_SKILL_DIR}/scripts/render.ts <md> -o <html> --strict`
6. HTML の絶対パスを伝える。修正の依頼は Markdown を直して再生成する

出力先は、ユーザーが場所を指定したらそれに従う。指定が無ければ `workspace-id:workspace-id` skill の規約で作業ディレクトリ `.agents/workspaces/<workspace-id>/` を作る。そこに `<nnnnnn>-main-diagram.md` と同名の `.html` を置く。workspace-id plugin が入っていなければカレントディレクトリに `diagram.md` と `diagram.html` を置く。

## フロー図とアーキテクチャ図を 1 枚に混ぜない

フロー図（時間的な順序・処理・分岐）とアーキテクチャ図（静的な構造・実体・接続）は矢印の意味が違う。前者の矢印は「次に進む」、後者は「通信する・依存する」なので、1 枚に混ぜると読み手はどこが構造でどこが時間順か区別できなくなる。

- 見たいのが「何がどう繋がっているか」ならアーキ系（`graph LR` + `subgraph`）。「いつ何をするか」ならフロー系（`flowchart TD` / `sequenceDiagram` / `stateDiagram-v2`）
- ノードに動詞（「保存する」「判定する」）を入れたくなるならフロー図、名詞（「DB」「API Gateway」）だけならアーキ図
- 両方欲しいと言われたら 2 枚に分けて並べる
- よくある混在: アーキ図の中に `{判断}` ノードを置く、フローチャートの途中に `[(DB)]` を処理ステップとして繋ぐ、アーキ図に同じサービスを 2 回出して呼び出し順を表す（これはシーケンス図に分ける）

## render.ts

beautiful-mermaid で Mermaid ブロックを SVG にし、残りの Markdown を shiki のハイライト付きで HTML にして、CSS 埋め込みの自己完結 HTML を出力する。

- オプション: `-o, --output`（省略時は `<input>.html`）、`-t, --title`、`--theme light|dark`（既定 light）、`--transparent` がある
- 検査用のオプション: `--strict`（エラーが 1 つでもあれば exit 1）、`--validate-only`（HTML を書かずに検査だけ）
- 検査するのは構文と孤立ノードだけ。`graph` / `flowchart` / `stateDiagram` でどのエッジにも繋がらないノードはエラーになるので、装飾用の要素は図ではなく本文に書く
- エラーは stderr に `[file:line] block #N: <message>` で出る。`--strict` なしでは、壊れたブロックは HTML 内のエラー表示に置き換わり、他のブロックは描画される
- 対応図種は `graph` / `flowchart`、`sequenceDiagram`、`classDiagram`、`erDiagram`、`stateDiagram(-v2)`、`xychart-beta` だけ。`gantt` や `pie` などは `Invalid mermaid header` で失敗する
- 外部画像やアイコンは埋め込めない。サービス種別はラベルの名前（必要なら絵文字）と `classDef` / `:::class` の色分けで表す

## 図を読みやすくする

- 同じ役割のノードが N 個並ぶなら `Workers["Worker × N (per tenant)"]` のように 1 ノードに畳み、N が何で決まるかを本文に書く
- 1 枚の図が 30 ノードを超えたら、抽象レベルを上げるか別の図に分ける
- フロー系は時間軸があるので `TD` を基本にする。アーキ系の向きに意味はないので、縦横どちらに長くなりすぎないかで決める
- エッジには目的や呼び出し方のラベルを付ける（`A -- "POST /api" --> B`）
