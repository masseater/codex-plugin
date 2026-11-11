---
name: automation-advisor
description: リポジトリの設計（hook・skill・rule・CI）と実際の作業履歴（AI セッション・git log・コード重複）を突き合わせる。そのうえで、まだ自動化されていない繰り返しを提案するレポートを .local-agents/ に出力する。
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep, Bash(ls *), Bash(find *), Bash(rg *), Bash(git log *), Bash(git diff *), Bash(cat *), Bash(similarity-ts *), Agent, ToolSearch, mcp__ccsight__*
---

# automation-advisor

リポジトリの「意図された設計（ドキュメント・設定）」と「実際に起きていること（AI活動履歴・git log・コード重複）」を交差分析し、まだ自動化されていない繰り返しパターンを発見して提案レポートとして出力する。

`$ARGUMENTS`

## このスキルが答える問い

「このリポジトリで繰り返されている作業のうち、まだ自動化されていないものは何か」

## 分析の2つの視点

```pseudocode
function analyze(repo):
  designed = scan_existing_automation(repo)
  actual = scan_actual_patterns(repo)

  findings = []

  for pattern in actual:
    if pattern in designed and designed[pattern].behavior != actual[pattern].behavior:
      findings.append({type: "drift", pattern, designed: designed[pattern], actual: actual[pattern]})
    else if pattern not in designed:
      findings.append({type: "unwritten", pattern, frequency: actual[pattern].count})

  return findings
```

### 視点 A: 既に自動化されているもの（意図された設計）

リポジトリ内の次の対象を走査し、「何が自動化済みか」の全体像を構築する。

- hooks（`.claude/settings.json`, `settings.local.json`, プラグインの hook 定義）
- skills（`.claude/skills/`, プラグインの skill 定義）
- rules（`.claude/rules/`, プラグインの rule 定義）
- AGENTS.md / CLAUDE.md の規約・制約
- CI/CD パイプライン（`.github/workflows/`, etc.）
- MCP サーバー設定
- lint 設定（eslint, oxlint, etc.）
- pre-commit / pre-push hooks（husky, lint-staged, etc.）

ビルトインの診断結果がユーザーから共有されていれば、乖離型の根拠に使う。

- `/skill-doctor`: skill ごとのコンテキストコストと使用頻度。使われていない skill は「定義されているが効いていない自動化」の候補
- `/doctor prompt-audit`: 指示ファイルの陳腐化・壊れた参照・矛盾。指示文の品質の問題はこちらに任せ、このレポートでは繰り返し作業の自動化に絞る

### 視点 B: 実際に繰り返されていること

以下のデータソースから「何が繰り返し発生しているか」を抽出する。データソースの選択と優先順位はエージェントが状況に応じて判断する。

- AI セッション履歴
  - ccsight の `mcp__ccsight__*` ツール: [references/ccsight.md](references/ccsight.md)（ツールごとの取得内容と活用パターン）
  - セッションファイル直接参照: [references/session-files.md](references/session-files.md)（Claude Code / Codex のファイルの場所と構造。ccsight が使えないときのフォールバック）
  - ユーザーが共有した `/insights` の出力: [references/insights.md](references/insights.md)
- git log のパターン（頻出するコミットメッセージ、繰り返される変更パターン）
- コード重複: [references/similarity-ts.md](references/similarity-ts.md)（実行方法と出力の読み方）
- ドキュメント重複（同じ記述が複数ファイルに散在）: [references/doc-duplication-tools.md](references/doc-duplication-tools.md)
- 手動で繰り返されているコマンド列

探索の深さはデータソースごとに制御する。目安は次のとおり。

```pseudocode
function calibrate_exploration(data_source):
  if data_source == "ccsight":
    // stats 1回 + sessions 一覧 1回 + セッション詳細 最大5件 + search 最大3クエリ
    // 合計 ~10 MCP コール以内に収める
    // stats.top_tools と stats.mcp_servers で仮説を立て、search で検証する流れ
    max_mcp_calls = 10

  if data_source == "git_log":
    // git log --oneline -100 で傾向を掴み、深掘りは最大2回
    max_commands = 3

  if data_source == "session_files":
    // セッションファイル直接参照は ccsight のフォールバック
    // 詳細分析が必要なためサブエージェントに委譲し、メインの context 圧迫を避ける
    // サブエージェントがセッションファイルを読み、繰り返しパターンを抽出して返す
    delegation = "subagent"

  if data_source == "similarity-ts":
    // 1回実行、結果をそのまま使う
    max_commands = 1
```

## 発見の2分類

### 乖離型（drift）

ドキュメントや設定に記述されているが、実際の挙動や運用が異なるもの。

例:

- AGENTS.md に「X をすること」と書いてあるが、セッション履歴ではそのルールが守られていない
- hook が定義されているが、実際にはほぼ発火していない（効果のない自動化）
- CI で検出しているはずのパターンが、手動で繰り返し修正されている

### 未言語化型（unwritten）

どこにも書かれていないが、繰り返し発生しているパターン。

例:

- 毎回同じ調査手順を踏んでいる（hook や skill にできる）
- 同じコマンド列が複数セッションで繰り返されている
- 同じ判断基準が毎回自然言語で再発見されている（rule にできる）
- コード上の同じパターンが複数箇所に存在する（共通化や lint ルール化できる）

## 提案の種別

発見に対して、次のいずれかの自動化手段を提案する。

- hook: 特定のイベント（ファイル編集、コマンド実行、セッション開始/終了）に対する自動処理
- skill: 再利用可能な手順・ワークフロー
- rule: `.claude/rules/` に置くエージェント向けの行動規範
- AGENTS.md 追記: プロジェクト規約への明文化
- CI パイプライン: GitHub Actions 等での自動検証
- MCP tool: 外部サービスとの連携自動化
- lint ルール: コードパターンの機械的検出
- 共通化: 重複コード・重複ドキュメントの統合

## 実行プロセス

```pseudocode
function run(repo):
  // Phase 1: 収集（並列実行可能）
  designed = scan_existing_automation(repo)
  actual = scan_actual_patterns(repo)

  // Phase 2: 交差分析
  findings = cross_analyze(designed, actual)

  // Phase 3: 提案生成
  proposals = []
  for finding in findings:
    proposal = {
      observation: finding.description,
      classification: finding.type,  // "drift" or "unwritten"
      suggested_means: select_automation_type(finding),
      evidence: finding.data_sources,
    }
    proposals.append(proposal)

  // Phase 4: レポート出力
  report_path = ".local-agents/automation-advisor-<YYYYMMDD-HHmmss>.md"
  write_report(report_path, proposals)
  return report_path
```

## レポート出力

- ファイルパス: `.local-agents/automation-advisor-<YYYYMMDD-HHmmss>.md`
- タイムスタンプはファイル名の一意性キーである。既存レポートがあっても上書きせず、常に新規ファイルを作成する
- 視点 A / B の分析結果を統合した提案一覧を含める。冒頭に提案の要約（1 提案 1 行）を置き、個別提案を後に続ける

## レポートに最低限含める情報

各提案には次の項目を含める。

- 何が繰り返されているか（観察事実）
- 分類（乖離型 / 未言語化型）
- 提案する自動化手段
- その手段を選んだ根拠
- 根拠となったデータソース

## 制約

- レポートファイルは `.local-agents/` 配下に出力する
- 会話ではレポートのパスと提案件数だけを伝える（内容はレポートに書く）
- 提案の実行は行わない（レポート生成のみ）
- 分析対象は現在のリポジトリのみ
