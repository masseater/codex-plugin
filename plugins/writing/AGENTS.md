# writing

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
文章を書くときの規範（ユーザー固有の文体規範を含む）を提供する。

## 構成の要点

- `good-writing` は日本語の説明文すべての基底規範。日本語の文章を書くたびに読ませる意図なので、description の対象を広く取っている。読み物の緩急設計は `good-writing/references/rhythm.md` にあり、記事や解説を書くときだけ読む
- `novel-writing` は小説用。説明文の規範と混ぜないため、`good-writing` とは別 skill にしている
- `write-article` は外部リポジトリへの push と PR 作成を伴うので `disable-model-invocation: true` にしている。ユーザーが `/writing:write-article` で呼んだときだけ動く
- 規範の本文は著者の文体そのものなので、一般論に置き換えたり語調を揃えたりする編集で中身を薄めない

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `good-writing`: 日本語の文章を書く・推敲するときの基底規範（目的と理由を書く、陳腐化する情報を書かない、読点の打ち方、目的→手段の語順、見出しの体言止め）。ドキュメント・コメント・コミットメッセージ・PR 本文・記事・解説など日本語の文章を書くとき、「AI っぽい」「読みにくい」文章を直すときに使う。
- **skill** `novel-writing`: 日本語の小説・物語を書く、増補する、改稿するときの創作原則。情報を人物の経験として書くこと、人物を固有の偏りとして扱うことを基準にする。説明文向けの good-writing の規範は小説にはそのまま当てはめない。
- **skill** `write-article`: 会話の内容や指定されたトピックから Zenn の技術記事を書き、ユーザーのレビューを経て `masseater/zenn-article` リポジトリに PR を出す。

<!-- END:component-list -->
