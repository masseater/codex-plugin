# docs: Phase のドキュメントと進行管理

対象: `specs/<spec>/phases/phase<N>-*.md` と overview.md。

- タスク: 「タスク」節のチェックボックスがすべて `- [x]` か。未完了があれば列挙する
- 完了条件: 「完了条件」節の各項目が満たされているか。テスト・lint・型チェックのコマンドが書かれていれば、それは品質の観点で実行する
- 依存: overview.md で Phase N が依存する Phase の phase ファイルが `status: completed` か
- 引き継ぎ: 「次 Phase への引き継ぎ」節に、次の Phase が使う成果物と未解決の課題が書かれているか
- Phase 間の整合（Phase 2 以降）: 前の Phase の「次 Phase への引き継ぎ」に挙がった成果物が、この Phase のタスクや設計で使われているか
