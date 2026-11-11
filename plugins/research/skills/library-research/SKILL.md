---
name: library-research
description: ライブラリ・フレームワークのリポジトリを clone して実際に動かしながら調べ、結果を再利用できるナレッジベース（library-knowledge skill）として保存する。「このライブラリ使えそうか調べて」「〜を徹底調査して」のように、依存として使うための調査を頼まれたときに使う。設計知見を Zettelkasten に蓄積する目的なら obsidian:repository-dissect を使う。
argument-hint: "[ライブラリ名]"
---

# Library Research

調査対象: `$ARGUMENTS`

リポジトリの情報の大半はリポジトリ自体にあるので、まず clone して機械的に抽出し、足りない分だけ外部を調べる。スクリプトは `${CLAUDE_SKILL_DIR}/scripts/` にあり、直接実行できる。

## 保存先と名前

- プロジェクト用: `.claude/skills/library-knowledge/`（既定）
- ユーザー用: `~/.claude/skills/library-knowledge/`（プロジェクト横断の汎用ライブラリ。各スクリプトに `--user` を付ける）

対話できるときは、どちらに保存するかをユーザーに確認する。確認できないときはプロジェクト用にする。保存先ディレクトリと `SKILL.md` はスクリプトが自動で作る。

ディレクトリ名にはライブラリ名を正規化した値を使う（`@octokit/rest` → `octokit-rest`）。`fetch-package-info.ts` が `normalizedName` として出力する。

## 手順

1. 既存調査を確認する。両方の保存先の `{normalizedName}/index.md` を探す
   - 対話できるとき: 見つかったら内容を示し、再調査するか確認する。`meta.yml` の `last_updated` が古ければ再調査を提案する
   - 対話できないとき: 再調査を指示されていればやり直す。指示が無く `last_updated` が 30 日以内なら既存内容を示して終える（無駄な再 clone を避けるため）。30 日より古ければやり直す
2. プロジェクト内での利用状況（import、依存定義、設定ファイル）を確認し、既に使われていれば使用箇所に関わる落とし穴を重点的に調べる
3. メタデータを取得する: `fetch-package-info.ts --name <identifier> --registry <npm|pypi|crates|go|github> [--user]`。`meta.yml` が保存先に書かれる
4. clone して分析する: `clone-and-analyze.ts --name <normalizedName> --repo <owner/repo> [--user] [--package <dir>]`
   - `--name` には raw の `@scope/name` ではなく `normalizedName` を渡す。ずれると `meta.yml` と `analysis.json` が別ディレクトリに分かれる
   - `--repo` は `meta.yml` の `repository` から取る。リネーム・移譲されている可能性があれば `gh api repos/<owner>/<repo> --jq .full_name` で正規名に解決してから渡す
   - モノレポで `meta.yml` に `repository_directory` があれば `--package` を付ける
   - `--cleanup` は付けない。clone は後の手順で読むため残し、手順 7 で削除する
   - clone 先のパスは stderr の `Clone preserved at: <path>` から取る
5. `analysis.json` で足りない部分は clone 先を直接読む（examples、tests、型定義、CHANGELOG の破壊的変更）
6. 一時ディレクトリにインストールし、基本的な使い方のコードを `bun <file>` で実行して、import の解決・型・基本 API・Bun での動作を確かめる

   ```bash
   TMPDIR=$(mktemp -d)
   ( cd "$TMPDIR" && bun init -y && bun add <package> )
   ```

7. 一時ディレクトリと clone を削除する
8. clone で得られない情報だけを外部から調べる。API の詳細ドキュメントと、利用者のハマりどころ（Issues、Discussions、ブログ）は常に調べる。代替との比較はユーザーが求めたとき、ランタイム互換性は懸念があるときに調べる
   - 情報源ごとに、取得前に次のコマンドで訪問済みか確認する。`"visited": true` なら飛ばす

     ```bash
     update-visited.ts --name <normalizedName> [--user] --check --key "<URL or query>"
     ```

   - 取得後に次のコマンドで記録する

     ```bash
     update-visited.ts --name <normalizedName> [--user] --type <url|search> --key "<URL or query>" --summary "<要約>"
     ```

   - Issue は state と createdAt / updatedAt を確認する。close 済みや古い Issue は現在の問題として書かず、過去の経緯として区別する
9. 成果物を保存する（次節）
10. `generate-index.ts [--user]` で `index.md` を生成し、内容をユーザーに示して終える

## 成果物

- 自動生成されるファイル（括弧内は生成するスクリプト）
  - `meta.yml`（fetch-package-info）、`analysis.json`（clone-and-analyze）
  - `visited.json`（update-visited）、`index.md`（generate-index）
- `meta.yml` に `tags`・`aliases`・`compatibility`（例: `bun: "yes"`, `node: "yes"`）を追記する。`fetch-package-info.ts` を再実行すると `meta.yml` は初期状態に戻るので、再調査ではこの追記を `generate-index.ts` の直前に再適用する
- 調査結果は `.md` ファイルとして自由に分けて書く。各ファイルの frontmatter に `title` と 1 行の `description` を付けると `index.md` に載る
- 調査の経緯・判断根拠は `research-log/` に残す。ここは index の対象外
- `index.md` は手で編集しない。内容を変えたいときは `meta.yml` やナレッジファイルを直して `generate-index.ts` を再実行する
