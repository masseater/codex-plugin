# requirements: 要件定義を書く

1. `specs/<spec>/overview.md` があることを確かめる
2. セキュリティ以外に必要な非機能要件を `AskUserQuestion`（`multiSelect: true`）で聞く。選択肢: パフォーマンス / 可用性 / 保守性 / ユーザビリティ / 制約条件 / テスト戦略 / 開発環境。セキュリティは常に含める
3. テンプレートをコピーする

   ```bash
   <skill-dir>/scripts/copy-templates.ts specs/<spec> specification
   ```

4. overview.md と調査結果（`specs/research/`）をもとに機能要件・非機能要件・ユースケースを書く。選ばれなかった非機能要件の節は消す。ステアリングの product.md と食い違わないようにする
