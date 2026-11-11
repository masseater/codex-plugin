---
name: create-issue
description: 会話や調査で見つかった 1 件以上の課題を、既存 Issue との重複を確認したうえで GitHub Issue として起票するか、既存 Issue にコメントする。承認を得てから実行する。
disable-model-invocation: true
allowed-tools: Bash(../../scripts/issue-db/*)
---

# Create Issue

Issue のタイトル・本文・コメントは英語で書き、ユーザーとの対話は日本語で行う。起票とコメントは外部に公開される操作なので、手順 5 の承認を得てから実行する。

## 手順

1. 課題（finding）を集める
   - 会話の文脈から取る。「リポジトリを調査して issue 化して」のように調査から頼まれた場合は、先にコードを調べて課題を洗い出す
   - 各 finding に、タイトル案・内容・根拠（`path/to/file.ts:42`、エラーメッセージ、再現手順）を持たせる。根拠のない finding は起票しない
   - 1 回の新規起票は 10 件までにする。超える分はユーザーに優先度を聞いて次回に回す

2. 対象リポジトリを決める
   - 既定は現在のリポジトリ（`gh repo view --json nameWithOwner -q .nameWithOwner`）
   - このプラグイン群（Claude Code plugin marketplace）へのフィードバックなら `masseater/codex-plugin` にし、`claude` ラベルを付ける。このラベルで Claude Code Action が起動する。以降のスクリプトには `--owner masseater --repo claude-code-plugin` を渡す

3. 重複を調べる。ローカルの issue キャッシュ（SQLite FTS5）を同期してから finding ごとに検索する

   ```bash
   ../../scripts/issue-db/sync.ts [--owner <o> --repo <r>]
   ../../scripts/issue-db/search.ts "<query>" --limit 20 [--owner <o> --repo <r>]
   ```

   query はタイトル案、主要なキーワード 3 つ、最も特徴的なファイル名やシンボルをつなげた自然文にする（`is:issue` などの GitHub 検索構文は使えない）。closed の Issue も対象に含める。過去の解決経緯が参考になるため。候補の類似度と推奨の決め方は [references/similarity.md](references/similarity.md) に従う。参照ファイルでは変数が展開されないので、そこにある `<plugin-root>` は `../..` に読み替える。

4. finding ごとの対応を決める
   - `duplicate`（open の high がある）: 既存 Issue にコメントする
   - `closed-duplicate`（high が closed だけにある）: reopen を頼むか、`Related: #<n>` 付きで新規起票するかをユーザーに聞く
   - `related`（high は無く medium がある。open / closed を問わない）: `Related: #<n>` を付けて新規起票する
   - `no-match`: 新規起票する
   - 既存 Issue の最終更新が 90 日以上前なら `[stale]` と示し、コメントか再起票かを選べるようにする

5. 下書きを作り、一括で承認を取る
   - タイトル: 72 文字以内、末尾にピリオドを付けない。対象があれば `[<plugin や package 名>] ` を前に付ける
   - 本文: [assets/issue-body.md](assets/issue-body.md) のテンプレートを使う。会話をそのまま貼らず要点にまとめ、secret・個人情報・内部 URL は入れない
   - ラベル: `gh label list -R <repo> --limit 100 --json name` で存在するものだけを付ける。種別とラベルの対応は次のとおり
     - bug→`bug`、機能要望→`enhancement`、技術的負債・lint・型→`tech-debt`、テスト不足→`test`
     - ドキュメント→`documentation`、依存→`dependencies`、性能→`performance`、セキュリティ→`security`
   - milestone と assignee は頼まれたときだけ付ける
   - `AskUserQuestion` で、finding ごとの対応・タイトル・ラベルの一覧を示し、すべて実行 / 個別に修正 / 中止 を選ばせる

6. 承認された分だけ実行する。本文は `mktemp` の一時ファイルで渡す（複数行のエスケープ事故と、並列実行時のファイル衝突を避けるため）

   ```bash
   BODY_FILE=$(mktemp -t issue-body.XXXXXX.md)
   cat > "$BODY_FILE" <<'EOF'
   <本文>
   EOF
   gh issue create -R <repo> --title "<title>" --body-file "$BODY_FILE" --label "<a>" --label "<b>"
   gh issue comment <number> -R <repo> --body-file "$BODY_FILE"   # 既存 Issue へのコメントの場合
   rm -f "$BODY_FILE"
   ```

7. 作成した Issue とコメントの URL、スキップした finding と理由を報告する
