# SDD Workflow Diagram

```mermaid
flowchart TB
    subgraph Step0["Step 0: プロジェクト方針定義（初回のみ）"]
        S0["永続的メモリを作成<br/>🤖 sdd-webapp登録<br/>📖 steering スキル"]
    end
    S0 -->|作成| A_steering[(.claude/skills/steering/SKILL.md)]

    subgraph Step1["Step 1: タスク初期化・設計・定義"]
        S1_1["仕様書の骨格を作成<br/>⌨️ /sdd:spec init"]
        S1_2["機能要件・非機能要件を定義<br/>⌨️ /sdd:spec requirements"]
        S1_3["技術詳細を設計<br/>⌨️ /sdd:spec technical"]
        S1_1 --> S1_2 --> S1_3
    end
    S1_1 -->|作成| A_overview[(specs/{spec}/overview.md)]
    S1_2 -->|作成| A_spec[(specs/{spec}/specification.md)]
    S1_3 -->|作成| A_tech[(specs/{spec}/technical-details.md)]

    subgraph Step2["Step 2: 調査・明確化"]
        S2_1["技術調査を実施<br/>🔁 項目ごとに繰り返し<br/>⌨️ /sdd:research conduct"]
        S2_2["不明点をユーザーに質問<br/>⌨️ /sdd:research clarify"]
        S2_1 --> S2_2
    end
    S2_1 -->|作成| A_research[(specs/research/*.md)]
    S2_1 -->|更新: 調査状態| A_overview
    S2_2 -->|更新: 不明マーク解消| A_spec
    S2_2 -->|更新: 不明マーク解消| A_tech

    subgraph Step3["Step 3: Phase構成決定"]
        S3["Phase構成を決定<br/>⌨️ /sdd:phase plan"]
    end
    S3 -->|更新: Phase構成| A_overview

    subgraph Step4["Step 4: Phaseサイクル（🔁 Phaseごとに繰り返し）"]
        S4_1["詳細計画書を作成<br/>⌨️ /sdd:phase breakdown"]
        S4_2["コード・テストを実装<br/>🤖 ステアリング準拠チェック<br/>⌨️ /sdd:phase implement"]
        S4_3["検証を実施<br/>⌨️ /sdd:validate"]
        S4_1 --> S4_2 --> S4_3
        S4_3 -->|問題あり| S4_2
    end
    S4_1 -->|作成| A_phase[(specs/{spec}/phases/phase{N}-{name}.md)]
    S4_2 -->|作成・更新| A_code[(ソースコード)]
    S4_2 -->|更新: タスク状態| A_phase

    subgraph Done["完了"]
        Archive["タスクをアーカイブ<br/>🤖 編集をブロック<br/>⌨️ /sdd:archive"]
    end
    Archive -->|移動| A_archived[(specs/_archived/{spec}/)]

    Step0 --> Step1 --> Step2 --> Step3 --> Step4
    S3 -->|要件不足| S1_2
    S3 -->|調査不足| S2_1
    S4_3 -->|問題なし・全Phase完了| Done
```

**凡例**: 🔁 繰り返し / 🤖 自動制御 / 📖 スキル
