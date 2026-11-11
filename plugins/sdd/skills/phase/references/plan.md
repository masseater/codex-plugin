# plan: Phase 構成を決める

タスクの詳細な分解はしない（breakdown で Phase ごとに行う）。

1. `specs/<spec>/` に overview.md・specification.md・technical-details.md があることを確かめる。overview.md に未完了の調査項目があれば、先に `/sdd:spec research` を勧める
2. 3 つの文書と調査結果から Phase の分け方を考える
   - 1 つの Phase は、独立してリリース・動作確認できる単位にする
   - 機能の依存関係で順序を決め、リスクの高いものや価値の高いものを先にする
   - 各 Phase はインターフェースから設計する。「User モデルを定義 → リポジトリを作る」ではなく「ユーザーの使い方 → API の呼ばれ方 → 内部の動き」の順にする。使われ方から設計すると不要な抽象化が入らず、境界がテストしやすくなる
   - Phase の数に上限はない。複雑さに合わせて決める
3. 構成案を提示し、`AskUserQuestion` で承認をもらう（承認 / 修正して再提案 / やり直し）
4. 承認されたら overview.md の「Phase 構成」節に書く。状態は書かない（phase ファイルが正）

   ```markdown
   ## Phase 構成

   ### Phase 1: <名称>

   - 目標: <目標>
   - 依存: なし
   - 成果物: <成果物>

   ### Phase 2: <名称>

   - 目標: <目標>
   - 依存: Phase 1
   - 成果物: <成果物>
   ```

5. Phase 間の依存関係を Mermaid の flowchart で同じ節の末尾に描く
