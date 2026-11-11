# implement: Phase のタスクを実装する

引数: `<spec>` だけなら最初の未完了の Phase、`<spec> N` なら Phase N の最初の未完了タスク、`<spec> N.M` ならそのタスクから始める。

1. overview.md・specification.md・technical-details.md と `phases/phase<N>-*.md` を読む
2. 依存する Phase が `completed` になっていることを確かめる。なっていなければ、その Phase を先に進めるよう伝える
3. phase ファイルの `status:` が `not_started` なら `in_progress` にし、sdd-webapp に反映する
4. 未完了のタスクをタスクリスト（TodoWrite、または TaskCreate / TaskUpdate）に積み、順に実装する。各タスクの中で Red → Green → Refactor を回す。先に失敗するテストを書いて失敗を確かめ（Red）、通る最小の実装を書き（Green）、テストを通したまま整える（Refactor）
5. タスクを終えるたびに、phase ファイルの完了条件にあるテスト・lint・型チェックのコマンドを実行して通し、そのタスクのチェックボックスを `- [x]` にする
6. 実装中に仕様の誤りや抜けに気づいたら、該当する spec 文書を直す。ユーザーの判断が要るものは `**不明**` として残し、そのタスクを飛ばして続ける
7. Phase の全タスクが終わったら `/sdd:validate phase <spec> <N>` を勧める。`status:` は検証が通ってから `completed` にする
