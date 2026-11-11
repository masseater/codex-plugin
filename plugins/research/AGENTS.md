# research

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
調査・分析のための skill とスクリプトを提供する。

## 開発コマンド

```bash
cd plugins/research
vp run check && vp run typecheck && vp run test
```

## 構成の要点

- 決定的な処理（パッケージ情報取得、clone と分析、訪問記録、index 生成、画像処理）は各 skill の `scripts/` に置き、SKILL.md には実行するコマンドと出力の使い方だけを書く。skill からは `${CLAUDE_SKILL_DIR}/scripts/...` で参照する
- `library-research` は依存として使うための調査、`obsidian:repository-dissect` は設計知見を Vault に蓄積するための分析。両 skill の description で使い分けを示している
- `semtools` は `user-invocable: false`。検索ツールの使い方の背景知識で、ユーザーが `/semtools` として直接呼ぶ意味がないため
- 画像は Claude が直接読めるので、`image-analyze` はローカルの差分・切り出し・拡大を主にし、Gemini 解析（`image-analyze.ts`）はユーザーが求めたときの任意の補助にとどめる

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `image-analyze`: スクリーンショット・デザイン画像をローカルで比較・加工する（ピクセル差分、重ね合わせ、横並べ、エッジ抽出、切り出しと拡大、メタデータ）。「Figma と実装がずれていないか比較して」「スクショの差分を見て」のように画像の比較や細部の確認を頼まれたときに使う。
- **skill** `library-research`: ライブラリ・フレームワークのリポジトリを clone して実際に動かしながら調べ、結果を再利用できるナレッジベース（library-knowledge skill）として保存する。「このライブラリ使えそうか調べて」「〜を徹底調査して」のように、依存として使うための調査を頼まれたときに使う。設計知見を Zettelkasten に蓄積する目的なら obsidian:repository-dissect を使う。
- **skill** `semtools`: semtools CLI（@llamaindex/semtools）でファイル内容を意味で検索する。grep ではキーワードが一致せず目的の箇所が見つからないとき、自然言語のクエリで Markdown・コード・ログなどを探すときに使う。
- **hook** `install-deps`: SessionStart

<!-- END:component-list -->
