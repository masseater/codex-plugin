# diagram-render

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Mermaid を含む Markdown を [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) で SVG にし、CSS 埋め込みの自己完結 HTML を出力する。

## 構成の要点

- skill は `draw-diagram` 1 本。変換スクリプトは `skills/draw-diagram/scripts/render.ts` にあり、SKILL.md からは `${CLAUDE_SKILL_DIR}/scripts/render.ts` で呼ぶ
- SKILL.md に書く図種・機能は render.ts の実際の挙動に合わせる。beautiful-mermaid が対応しない図種（`gantt`、`pie` など）や、render.ts が検査していない項目を「検査される」と書かない

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `draw-diagram`: Mermaid を含む Markdown でアーキテクチャ図・システム構成図・フローチャート・シーケンス図・依存関係図・ER 図・状態遷移図を書き、図を埋め込んだ自己完結 HTML に変換する。「アーキテクチャ図を書いて」「処理の流れを図にして」のように閲覧用の図を頼まれたときに使う。既存の Mermaid 入り Markdown を HTML にしたいときにも使う。
- **hook** `install-deps`: SessionStart

<!-- END:component-list -->
