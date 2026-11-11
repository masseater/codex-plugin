# obsidian

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Obsidian Vault（`~/Documents/Zettelkasten`）の Zettelkasten 式知識蓄積と Daily Notes を扱う。Obsidian アプリ本体の設定やプラグイン管理は扱わない。

## 構成の要点

- ノート形式・ソースリンク規約は `assets/note-format.md`、Vault の初期化と pre-commit hook の設置は `assets/setup-vault.sh` が正本。skill からは `./assets/...` で参照する
- ノートを書く入口は `zettelkasten` skill だけにする。セッション末の自動書き出しは Stop hook（`session-note`）が 1 セッション 1 回だけ促し、`vault-maintainer` エージェントが `zettelkasten` skill で書く
- 壊れた wikilink は PostToolUse hook（`vault-lint`）と Vault の pre-commit hook が決定的に検出する。skill に wikilink の検証手順は書かない
- `zettelkasten` / `daily` / `repository-dissect` は Vault へのノート追加と、それに付随するローカル commit をする。commit は作業の記録として付随するだけなので副作用として扱わず、model invocation を許可したままにする。`zettelkasten` は `vault-maintainer` が `skills:` で事前読み込みするので、どのみち `disable-model-invocation: true` にできない
- 削除と commit を伴う整理（修復・Fleeting の統合）は `maintain`（`disable-model-invocation: true`）に集め、ユーザーが `/obsidian:maintain` で起動する。サブエージェントからは呼べないので、エージェントの手順に入れない

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `daily`: Obsidian Vault の `04-Daily/YYYY-MM-DD.md` に日記を書き、その日に作成した Zettelkasten ノートを列挙する。ユーザーが「日記を書く」「今日あったこと」「日報」「daily note」のように 1 日の記録を頼んだときに使う。
- **skill** `maintain`: Zettelkasten Vault の健全性チェック・統計・修復をし、Fleeting Notes を Permanent Note へ統合する。
- **skill** `recall`: Zettelkasten Vault（~/Documents/Zettelkasten）からノートを検索する。「前に書いたっけ」「〜について何か書いてた」のような曖昧な想起と、キーワード・タグ・種別・被リンクを指定した明確な検索の両方を扱う。作業前に過去の判断や調査結果を確認したいときにも使う。
- **skill** `repository-dissect`: リポジトリを分析し、設計判断・アーキテクチャパターン・汎用的な知見を Vault に蓄積する。蓄積先は Zettelkasten の Literature / Permanent ノートと索引ノートである。ユーザーが「このリポジトリを解剖して Zettelkasten に」のように Vault への知見抽出を頼んだときに使う。依存ライブラリの使い方を調べる目的なら research:library-research を使う。
- **skill** `review`: Zettelkasten の過去ノートを再読し、忘れていた知見の再発見や、まだリンクされていないノート同士の接続を提案する。ユーザーが「ノートを振り返りたい」「最近何を書いたっけ」「忘れてるノートがないか見て」と頼んだときに使う。
- **skill** `zettelkasten`: Zettelkasten Vault（~/Documents/Zettelkasten）にノートを書き、既存ノートと wikilink で接続して commit する。ユーザーが「メモして」「ノートにして」「Zettelkasten に保存」のように記録を頼んだとき、またはセッション知見の書き出しを促されたときに使う。
- **agent** `vault-maintainer`: セッションで得た知見を Zettelkasten Vault にノートとして書き出す。メインの会話から書き出す内容（知見の要点と根拠、関連するファイルや URL）を受け取って使う。
- **agent** `vault-recaller`: Zettelkasten Vault から、与えられたタスクに関係する過去の判断・既知の落とし穴・調査結果を探して要約する。作業を始める前に過去の知見を確認したいときに使う。
- **hook** `install-deps`: SessionStart
- **hook** `session-note`: Stop
- **hook** `vault-lint`: PostToolUse (`Write|Edit`)

<!-- END:component-list -->
