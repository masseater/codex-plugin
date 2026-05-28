---
name: research:library-research
description: ライブラリ・フレームワーク・ツールの徹底調査と知識ベース永続化。Use when deeply researching a library/framework/tool (clone-first analysis, hands-on verification) and persisting the findings as a reusable knowledge base.
argument-hint: "[ライブラリ名]"
---

# Library Research

Clone-First アプローチによるライブラリ調査ワークフロー。
リポジトリを直接 clone して機械的にデータを抽出し、不足分だけ外部調査する。

調査対象: `$ARGUMENTS`

## ナレッジベースの保存先

| 保存先         | パス                                  | 用途                               |
| -------------- | ------------------------------------- | ---------------------------------- |
| プロジェクト用 | `.claude/skills/library-knowledge/`   | プロジェクト固有ライブラリ         |
| ユーザー用     | `~/.claude/skills/library-knowledge/` | 汎用ライブラリ（プロジェクト横断） |

保存先ディレクトリと `SKILL.md` は各スクリプトが `resolve-knowledge-dir` を通じて自動作成する。

### ライブラリ名の正規化

ディレクトリ名として使う `{library-name}` は以下のルールで正規化:

- スコープ付き: `@octokit/rest` → `octokit-rest`
- そのまま: `express` → `express`

---

## Phase 0: 準備

### 0a. 保存先の確認

- IF: 対話可能; THEN MUST: AskUserQuestion で保存先（プロジェクト / ユーザー）を確認する
- IF: 非対話・自動実行でユーザーに確認できない; THEN MUST: プロジェクト保存（`--user` を付けない）をデフォルトとして進める

### 0b. 既存調査の検索

MUST: **両方**の保存先から既存調査を検索する:

```
.claude/skills/library-knowledge/{library-name}/index.md
~/.claude/skills/library-knowledge/{library-name}/index.md
```

- IF: 既存調査が見つかった AND 対話可能; THEN MUST: 内容を提示し、再調査が必要か確認する
  - IF: `meta.yml` の `last_updated` が古い; THEN SHOULD: 再調査を提案する
  - IF: 再調査が不要; THEN MUST: 終了する
- IF: 既存調査が見つかった AND 非対話・自動実行で確認できない; THEN MUST: 以下を順に判定する
  1. IF: 明示的に再調査を指示されている; THEN MUST: 上書き再生成する
  2. IF: 再調査の指示がない AND `last_updated` が 30 日以内; THEN MUST: 既存内容を提示して終了する（無駄な再 clone を避ける）
  3. IF: 再調査の指示がない AND `last_updated` が 30 日より古い; THEN MUST: 再調査を実行する

### 0c. プロジェクト内利用確認

MUST: Grep/Read で既存の利用状況を**早期に**確認する。確認対象:

- `import` 文での利用箇所
- `package.json` での依存関係
- 設定ファイル（`.config.ts` 等）

IF: プロジェクト内で既に使われている; THEN MUST: 調査スコープに反映する（使用箇所の把握 → gotchas の重点調査等）

---

## Phase 1: 自動収集（Clone-First）

リポジトリの情報の大半はリポジトリ自体にある。まず clone して機械的に抽出する。

### 1a. パッケージメタデータ取得

```bash
./scripts/fetch-package-info.ts --name <identifier> --registry <npm|pypi|crates|go|github> [--user]
```

対応レジストリ:

| レジストリ | エンドポイント                                          |
| ---------- | ------------------------------------------------------- |
| npm        | `registry.npmjs.org/{name}`                             |
| pypi       | `pypi.org/pypi/{name}/json`                             |
| crates     | `crates.io/api/v1/crates/{name}`                        |
| go         | `proxy.golang.org/{module}/@latest`                     |
| github     | `api.github.com/repos/{owner}/{repo}` + releases/latest |

`meta.yml` はナレッジディレクトリに直接書き込まれる。

### 1b. リポジトリ clone + 自動分析

```bash
./scripts/clone-and-analyze.ts --name <library-name> --repo <owner/repo> [--user] [--package <directory>] [--cleanup]
```

`--name` は **正規化済みライブラリ名（= ナレッジディレクトリ名）**を渡す。fetch-package-info.ts は raw な `@scope/name` を受け取って内部で正規化し、その値を `normalizedName`（= ディレクトリ名、例: `paralleldrive-cuid2`）として出力する。

IF: clone-and-analyze.ts を実行する; THEN MUST: `--name` に `normalizedName`（raw な `@scope/name` ではない）を渡す（両スクリプトが同じディレクトリに書き込むため、ずれると meta.yml と analysis.json が別ディレクトリに分かれる）

`--repo` は `owner/repo` 形式で、meta.yml の `repository` フィールド（`https://github.com/owner/repo`）から抽出する。

IF: リポジトリがリネーム・移譲され meta.yml の `repository` が古い（リダイレクト先の）可能性がある; THEN MUST: `gh api repos/<owner>/<repo> --jq .full_name` で正規名に解決してから `--repo` に渡す

IF: 対象がモノレポ AND meta.yml に `repository_directory` がある; THEN MUST: `--package` を追加する

`--cleanup` は分析後に clone を即削除するフラグ。

IF: Phase 1b で clone-and-analyze.ts を実行する; THEN MUST NOT: `--cleanup` を付ける（clone は Phase 1c / 2 で参照するため残し、削除は Phase 2c で行う）

スクリプトが `analysis.json` を出力する。内容:

- README.md 全文
- マニフェスト情報（package.json / pyproject.toml / Cargo.toml / go.mod を自動検出）
- TypeScript 設定（strict, target 等）
- ディレクトリ構造（examples/, tests/, src/ の有無とファイル一覧）
- CI 設定（GitHub Actions の Node/Bun バージョンマトリクス）
- CHANGELOG.md（最新3バージョン分）
- examples/ 内のサンプルコード
- LICENSE

### 1c. clone したリポジトリを直接読む

`analysis.json` だけでは不十分な場合、clone 先を直接 Read する:

- **README.md** → quick-start の基礎情報
- **examples/** → 実際の使用パターン
- **CHANGELOG.md** → 破壊的変更の詳細
- **tests/** → テストから読み取れる実際の使い方・エッジケース
- **src/ の型定義** → API の正確な理解

この時点でリポジトリ内の情報は網羅的に取得済み。clone はこの後の検証で使用するため残しておく。

---

## Phase 2: 実践検証

### 2a. インストール + 動作確認

一時ディレクトリで実際にインストール・実行:

```bash
TMPDIR=$(mktemp -d)
# cd は subshell に閉じる（永続的な cd はシェル状態を壊しやすい）
( cd "$TMPDIR" && bun init -y && bun add {library-name} )
```

テストコードを作成して実行する。`IF: テストコードを実行する; THEN MUST: bun を前置する`（shebang/実行権限に依存しないため）:

```bash
cat > "$TMPDIR/test.ts" << 'EOF'
import { ... } from "{library-name}";
// 基本的な使い方のコード
console.log("OK");
EOF
bun "$TMPDIR/test.ts"
```

確認項目:

- import が正しく解決されるか
- TypeScript の型が効くか
- 基本 API が期待通り動作するか
- Bun ランタイムで問題なく動くか

### 2b. クリーンアップ

```bash
rm -rf $TMPDIR
```

### 2c. clone リポジトリの削除

検証完了後、clone したリポジトリを削除してディスク容量を節約する。

`{clone先ディレクトリ}` は 1b の `clone-and-analyze.ts` が **stderr に `Clone preserved at: <path>` 形式で出力**したパス。そこから取得する。

```bash
rm -rf {clone先ディレクトリ}
```

---

## Phase 3: 深堀調査（外部情報のみ）

clone で得られない情報だけを外部から取得する。

以下の視点を意識して調査する:

| 視点         | 関心事                         | 情報源                             |
| ------------ | ------------------------------ | ---------------------------------- |
| 新規ユーザー | 導入の容易さ、最小コード例     | README, examples/, Getting Started |
| 開発者       | API設計、型サポート、拡張性    | src/, types, API docs              |
| メンテナ     | コード品質、テスト、CI         | tests/, .github/, coverage         |
| 評価者       | 代替との比較、トレンド、将来性 | npm trends, GitHub stats, Issues   |
| 運用者       | 互換性、既知バグ、破壊的変更   | CHANGELOG, Issues, CI matrix       |

### visited.json による重複排除

調査の各ステップで以下のワークフローを繰り返す:

1. **確認**: 訪問済みかチェック
   ```bash
   ./scripts/update-visited.ts --name {library-name} [--user] --check --key "{URL or query}"
   ```
2. **訪問済みならスキップ**: `"visited": true` なら次の情報源へ
3. **未訪問なら取得**: WebSearch, WebFetch, MCP, gh CLI 等で情報を取得
4. **記録**: 取得後に訪問を記録
   ```bash
   ./scripts/update-visited.ts --name {library-name} [--user] --type url --key "{URL}" --summary "{要約}"
   ```
   `--type` は `url`（URL）または `search`（検索クエリ）のいずれか。検索クエリを記録するときは `--type search --key "{クエリ}"` とする。

### 取得対象（目的ベース）

| 目的                                                              | 要求度 | 条件                             |
| ----------------------------------------------------------------- | ------ | -------------------------------- |
| API の詳細ドキュメント（公式ドキュメント、MCP 経由等）            | MUST   | 常時                             |
| ユーザーの実体験・ハマりポイント（Issues, Discussions, ブログ等） | MUST   | 常時                             |
| 代替ライブラリとの比較                                            | MUST   | ユーザーが比較を依頼した場合     |
| ランタイム互換性（Bun 等）                                        | SHOULD | ランタイム互換性に懸念がある場合 |

手段は固定しない。`MAY`: 目的を達成できるなら何を使ってもよい（WebSearch, WebFetch, MCP, gh CLI 等）。

- IF: GitHub Issues を調査する; THEN MUST: 各 Issue の **state / createdAt / updatedAt** を確認する
- IF: Issue が close 済み OR 古い; THEN MUST NOT: 現在の問題として記録する（代わりに過去の経緯として明示的に区別して扱う）

---

## Phase 4: 成果物整理 + 永続化

### 自動生成ファイル

| ファイル        | 生成元                | 用途                                       |
| --------------- | --------------------- | ------------------------------------------ |
| `meta.yml`      | fetch-package-info.ts | パッケージメタデータ                       |
| `analysis.json` | clone-and-analyze.ts  | リポジトリの構造化データ                   |
| `visited.json`  | update-visited.ts     | 訪問済みURL/検索クエリの追跡               |
| `index.md`      | generate-index.ts     | ナレッジのエントリポイント（手動編集禁止） |

### meta.yml への追記

`fetch-package-info.ts` が生成した meta.yml に以下を手動追記:

```yaml
tags: ["github", "api"]
aliases: ["@octokit/rest"]
compatibility:
  bun: "yes"
  node: "yes"
```

### ナレッジファイル

調査結果を `.md` ファイルとして自由に作成する。ファイル名・分割粒度・構成は調査内容に応じて判断する。

各ファイルの先頭に frontmatter を付与（generate-index.ts がインデックスに反映する）:

```yaml
---
title: "ファイルのタイトル"
description: "このファイルの概要（1行）"
---
```

### research-log/

調査過程の時系列ログを `research-log/` ディレクトリに保存する。
ファイル名・形式は自由。調査の経緯・判断根拠・試行錯誤を記録し、再調査時の参考にする。

**注意**: research-log/ はインデックスには含まれない（generate-index.ts の走査対象外）。あくまで生の調査ログとして保存する。

### INDEX 生成

`generate-index.ts` は index.md の frontmatter を meta.yml から導出する。`fetch-package-info.ts` を再実行すると meta.yml は bare な状態にリセットされる。

- IF: 再調査で `fetch-package-info.ts` を再実行した; THEN MUST: 「meta.yml への追記」（tags / aliases / compatibility）を `generate-index.ts` の実行直前に再適用してから index を生成する（順序が逆だと手動追記が index.md に反映されない）
- IF: index.md の内容を変更したい; THEN MUST NOT: index.md を手動編集する（代わりに meta.yml / ナレッジファイルを編集し `generate-index.ts` を再実行する）

```bash
./scripts/generate-index.ts [--user]
```

生成された index.md の内容をユーザーに提示して完了報告。
