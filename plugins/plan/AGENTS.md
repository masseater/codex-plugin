# plan

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
計画ファイルの構造テンプレートと記述規約。

- `define` は model invocation を許可する。「計画を立てて」は自然文で頼まれ、Plan mode や persona:planner からも呼ばれる主要ワークフローのため
- 計画ファイルの置き場所（`.local-agents/plans/`）と計画に書く項目（目的・成果物・手段と選択理由・ブランチと worktree）は、mutils の個人 AGENTS.md（`assets/AGENTS.md`）の計画節と揃える

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `define`: 計画ファイル（User Prompts / Purpose / Approach / Branch / Structure / TODO / Verification）を規定の構成と記述規約で書く。「計画を立てて」「plan を作って」と頼まれたとき、Plan mode で計画を作るとき、Issue 番号や URL から実装計画を作るときに使う。

<!-- END:component-list -->
