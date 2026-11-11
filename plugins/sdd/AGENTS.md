# sdd プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
SDD（Spec-Driven Development）ワークフロー支援プラグイン。仕様書に基づいた段階的な実装を支援する。

- 流れと状態の持ち方: [docs/workflow-diagram.md](docs/workflow-diagram.md)。生成されるファイル: [docs/directory-structure.md](docs/directory-structure.md)
- skill の起動制御: `archive` は spec を移動して commit することそのものが目的である。`autopilot` は実装から commit まで長時間にわたり自律実行する。この 2 つは開始のタイミングを人が決めるので `disable-model-invocation: true` にしている。ほかの skill（steering / spec / phase / validate / status）は自然文で頼まれる主要ワークフローなので model invocation を許可する。spec と phase が sdd-webapp のストアに行うプロジェクト登録と Phase 状態の反映は、ローカルのダッシュボード用の写しで spec ファイルから作り直せるので、永続状態の変更には数えない
- 複数 skill で共有する規約は `assets/common-rules.md`。agent と skill から `./assets/common-rules.md` で参照する
- skill の参照ファイル（`references/*.md`）では `${...}` が展開されないので、`<skill-dir>` / `<plugin-root>` と書き、SKILL.md で読み替えを指示する
- phase ファイルの場所 `specs/<spec>/phases/phase<N>-<name>.md` は、3 か所のコードが前提にしている。1 つ目は `hooks/entry/require-phase-status.ts` の `PHASE_FILE_PATH` である。残りは `skills/status/scripts/spec-state.ts` と、apps/sdd-webapp の `status-parser.ts` である。変えるときは 3 か所とテストを揃える
- overview.md と phase ファイルの書式（frontmatter の status、調査項目とタスクのチェックボックス、`### Phase N:` 見出し）は `spec-state.ts` が解析する。テンプレートを変えたら `spec-state.test.ts` を通す
- MCP サーバー sdd-webapp（`@r_masseater/sdd-webapp`）は `.mcp.json` で登録する。webapp の Phase 状態は独自ストアにあるので、status を変える skill は `mcp__plugin_sdd_sdd-webapp__sdd_webapp_set_phase` も呼ぶ

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `archive`: status が completed か rejected の spec を選んで specs/_archived/ に移動し、コミットする。
- **skill** `autopilot`: SDD の spec を、ユーザーの確認を最小限にして steering の確認から最後の Phase の検証まで自動で進める。
- **skill** `phase`: SDD の spec を Phase に分け、Phase ごとの詳細計画・実装・Phase の挿入・中断前の状態反映をする。「Phase 構成を決めて」「Phase 2 の計画を立てて」「Phase 1 を実装して」「Phase を追加して」「ここまでの進捗を反映して」と頼まれたときに使う。
- **skill** `spec`: SDD の仕様書（overview / specification / technical-details）を作り、調査項目の調査と「不明」箇所の確認で埋めていく。「仕様書を作りたい」「要件定義して」「技術設計を書いて」「調査項目を調べて」「不明点を確認して」と頼まれたときに使う。
- **skill** `status`: SDD の各 spec の進み具合と次にやる作業を示し、SDD の流れを説明する。「SDD の進捗を見せて」「次に何をすればいいか教えて」「spec の一覧を見せて」「SDD の使い方を教えて」と聞かれたときに使う。
- **skill** `steering`: プロジェクトの方針（プロダクト・技術スタック・構造・開発原則）をステアリング文書として .claude/skills/steering/ に作る、または旧配置から移行する。SDD を始めるとき、「プロジェクト方針を整理したい」「steering を作って」と頼まれたときに使う。
- **skill** `validate`: SDD の spec 文書（矛盾・ステアリング準拠・実現可能性）か、実装を終えた Phase（ドキュメント・要件・品質）を検証し、指摘を severity 付きで報告する。「仕様書をチェックして」「矛盾がないか見て」「Phase 2 の実装を検証して」「これで完了でいいか確認して」と頼まれたときに使う。
- **agent** `contradiction-checker`: SDD の spec 文書（overview / specification / technical-details / phases）の間の矛盾を探す。修正はせず、severity と confidence 付きで報告する。/sdd:validate の spec モードから呼ばれる。
- **agent** `steering-reviewer`: コードや SDD の spec 文書がステアリング文書（.claude/skills/steering/）の方針に沿っているかをレビューする。修正はせず、severity と confidence 付きで報告する。/sdd:validate の spec モードから呼ばれる。
- **hook** `block-archived-edit`: PreToolUse (`Write|Edit`)
- **hook** `install-deps`: SessionStart
- **hook** `require-phase-status`: PreToolUse (`Write|Edit`)

<!-- END:component-list -->
