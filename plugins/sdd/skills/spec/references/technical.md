# technical: 技術詳細を書く

1. `specs/<spec>/overview.md` と `specification.md` があることを確かめる
2. overview.md・specification.md・調査結果と、ステアリングの tech.md / structure.md を読む
3. テンプレートをコピーする

   ```bash
   <skill-dir>/scripts/copy-templates.ts specs/<spec> technical-details
   ```

4. 技術スタック・アーキテクチャ・インターフェース・データ設計を書く
   - 技術スタックは tech.md に合わせ、逸脱するなら理由を書く
   - インターフェースは使われ方から先に書く（「ユーザーの使い方 → API の呼ばれ方 → 内部の動き」）。使用場面から設計すると不要な抽象化が入らず、外部との契約が先に固まる
   - specification.md は「何を満たすか」、technical-details.md は「どう作るか」を書き、内容を重複させない
5. 書き終えたら `/sdd:validate spec <spec>` の feasibility 観点で、実際のプロジェクト構造と食い違いがないかを確かめる
