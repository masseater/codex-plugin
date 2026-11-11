---
name: archive
disable-model-invocation: true
description: status が completed か rejected の spec を選んで specs/_archived/ に移動し、コミットする。
argument-hint: "[spec 名]"
---

# spec のアーカイブ

1. 候補を集める。`specs/` 配下（`_archived` と `research` を除く）の各 spec について、overview.md の frontmatter の `status:` を読む。`completed` か `rejected` のものだけを候補にする。`../status/scripts/spec-state.ts specs` の出力の `status` を使ってよい
2. 候補がなければ、その旨と、各 spec の現在の status を伝えて終える
3. 引数で spec 名を渡されていなければ、候補を「<spec>（<status>）」の形で `AskUserQuestion` に並べて選んでもらう
4. `specs/_archived/<spec>/` が既にあれば、既にアーカイブ済みだと伝えて止める
5. 移動する。Git リポジトリ内なら `git mv`、そうでなければ `mv` を使う

   ```bash
   mkdir -p specs/_archived
   git mv specs/<spec> specs/_archived/<spec>
   ```

6. Git リポジトリ内なら、移動だけをコミットする。メッセージの言語・形式と末尾の attribution はこのリポジトリとセッションのコミット規約に従い、spec 名と status を含める。規約が無ければ `Archive spec: <spec> (<status>)` とする
7. アーカイブ先のパスと status を伝える。`specs/_archived/` 配下は hook で編集できなくなる。sdd-webapp のストアにある Phase の状態は消さない。ストアのキーは spec 名と Phase 番号で、ダッシュボードはアーカイブ済みの spec の状態もこの値から表示するため
