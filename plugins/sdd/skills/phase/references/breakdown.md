# breakdown: Phase の詳細計画を作る

前提: overview.md の「Phase 構成」に Phase N がある（なければ `/sdd:phase plan` を先に勧める）。

1. overview.md から Phase N の目標・依存・成果物を、specification.md と technical-details.md から該当する要件と設計を抜き出す
2. `<skill-dir>/assets/phase-template.md` を読み、`specs/<spec>/phases/phase<N>-<name>.md` を書く。frontmatter は `status: not_started`
3. タスクの分け方
   - 1 タスクで Red → Green → Refactor のサイクルが 1 回以上完結する大きさにする。Red / Green / Refactor を別々のタスクに分けない（タスクの完了時にテストが通っている状態にするため）
   - タスク名が「A と B」になるなら分ける
   - 直列のタスクは `N.1`、`N.2` …、並列に進められるタスクは `N.2a`、`N.2b` のように枝番を付ける
   - 調査や設計の検討はタスクにしない。「認証ライブラリの選定」は Phase の前に research で済ませ、Phase には「認証 API の実装」のような作るタスクだけを入れる
4. 「完了条件」に、このプロジェクトで実行するテスト・lint・型チェックのコマンドを書く。package.json やステアリングの tech.md から探す
5. 「次 Phase への引き継ぎ」に、次の Phase が使う成果物を書く
6. 状態を変えたら（新規作成時は `not_started`）、SKILL.md の手順で sdd-webapp に反映する
