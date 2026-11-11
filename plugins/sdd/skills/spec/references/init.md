# init: spec の骨格を作る

1. `/sdd:spec init` の引数や依頼文に作りたいものの説明がなければ、何を作りたいかをユーザーに聞く
2. 説明から spec 名を決める。英小文字・数字・ハイフンだけで、`specs/` 内で一意にする（例: `user-authentication`）。`AskUserQuestion` で確認する
3. overview.md だけをコピーする。specification.md と technical-details.md は requirements / technical の段階で作る（ファイルの有無で次の作業を判定するため）

   ```bash
   <skill-dir>/scripts/copy-templates.ts specs/<spec> overview
   ```

4. overview.md の目的・スコープ・成果物・実装概要を説明に合わせて書く。frontmatter の `status` は `not_started` のまま
5. 調査項目を書く。技術選定や実現方法の検証など、仕様を書く前に調べる必要があるものだけを `- [ ] <調査項目名> — <理由>` で並べる。なければ「なし」と書く
6. 「Phase 構成」節は空のまま残す（`/sdd:phase plan` が書く）
7. sdd-webapp に未登録なら登録する。`mcp__plugin_sdd_sdd-webapp__sdd_webapp_list_projects` でこのリポジトリが見つからなければ登録する。登録は `mcp__plugin_sdd_sdd-webapp__sdd_webapp_add_project` にリポジトリのルートの絶対パスを渡して行う。webapp は `specs/` があるプロジェクトしか登録できないので、3 で `specs/` ができた後のこの段で行う
