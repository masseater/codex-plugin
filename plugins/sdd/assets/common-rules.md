# SDD 文書の共通ルール

spec 文書（`overview.md` / `specification.md` / `technical-details.md` / `phases/*.md` / `specs/research/*.md`）を書くときに従う。

- 必要な部分を必要なだけ書く。詳しさは品質ではない
- 「将来必要になる」「今後〜が必要」という推測に基づく要件や設計を書かない。今回のスコープで明確に必要なことだけを書く
- 決められないことは勝手に決めず、`**不明**: <何が決まっていないか>` と書いて、その下に案 A / 案 B / 案 C を並べる。`/sdd:spec clarify` がこの印を拾ってユーザーに質問する
- 工数・期間・見積もり時間は書かない
- 技術的な判断はステアリング（`.claude/skills/steering/` の tech.md / structure.md）に合わせる。逸脱するときは理由を書く
- Phase とタスクの状態は phase ファイルの frontmatter `status:` とタスクのチェックボックスが正。overview.md には状態を書き写さない（二重管理で食い違うため）
