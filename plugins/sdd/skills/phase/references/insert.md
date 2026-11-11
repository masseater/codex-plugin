# insert: Phase を挿入する

引数: `<spec> [位置]`。位置は「この番号の Phase の前に入れる」を表す。省略したら末尾に足す。

## 制約

- 挿入できるのは、最初の未着手（`status: not_started`）の Phase の位置から末尾までの間
- `in_progress` / `completed` の Phase のファイルは変更しない
- Phase の番号とファイル名の番号は常に一致させる

```text
Phase 1: completed    ← 変更しない
Phase 2: in_progress  ← 変更しない
Phase 3: not_started  ← ここから後ろに挿入できる（リネーム対象）
Phase 4: not_started  ← リネーム対象
```

## 手順

1. overview.md の「Phase 構成」と `specs/<spec>/phases/` の各ファイルの `status:` を読む
2. 指定位置が最初の未着手 Phase より前なら、挿入できる位置を示して止める
3. 新しい Phase の名称・目標・成果物・依存する Phase を `AskUserQuestion` で聞く
4. 挿入位置以降の phase ファイルを、番号の大きいものから順に 1 つずつ後ろへリネームする。前から処理すると、リネーム先のファイルを上書きしてしまうため。リネームの前に各ファイルの `status:` が `not_started` であることを確かめる

   ```bash
   # Phase 3 の前に挿入する例
   git mv specs/<spec>/phases/phase4-ui.md specs/<spec>/phases/phase5-ui.md
   git mv specs/<spec>/phases/phase3-api.md specs/<spec>/phases/phase4-api.md
   ```

5. リネームしたファイルの見出し（`# Phase <N>: …`）とタスク番号を新しい番号に合わせる
6. overview.md の「Phase 構成」で挿入位置以降の番号を 1 つずつずらし、新しい Phase を足す。「依存: Phase N」の参照もずらした番号に合わせる
7. sdd-webapp にも反映する。SKILL.md の「状態を変えたら」と同じ方法で `project_id` を得る。挿入した Phase とずらした各 Phase を、新しい番号・名前と `not_started` で 1 件ずつ `mcp__plugin_sdd_sdd-webapp__sdd_webapp_set_phase` に渡す。ストアのキーは spec 名と Phase 番号なので、古い番号の値はこれで上書きされ、`delete_phase` は要らない。ずらすのは未着手の Phase だけなので状態も変わらない
8. 新しい Phase の詳細計画は `/sdd:phase breakdown <spec> <N>` で作る
