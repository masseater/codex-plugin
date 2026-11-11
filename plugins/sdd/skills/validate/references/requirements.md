# requirements: 要件と実装の整合

対象: Phase N のタスクが実装したコードと、specification.md / technical-details.md。

- 機能要件: この Phase が担う機能（phase ファイルの概要とタスク詳細から特定する）ごとに、実装ファイルを読み、入出力・事前条件・事後条件・エラー処理が specification.md どおりか。エッジケースと例外処理、対応するテストの有無も見る
- 非機能要件: specification.md の非機能要件（セキュリティは必ず）について、実装上の対応があるか
- 技術詳細: technical-details.md の技術スタック・データ設計・インターフェースが実装と一致しているか（import、型定義、ルーティング、レスポンス形式）
- Phase 間（Phase 2 以降）: 前の Phase の成果物が存在し、この Phase の実装から使われているか。export されたインターフェースと使い方が一致しているか
