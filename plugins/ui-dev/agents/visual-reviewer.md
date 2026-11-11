---
name: visual-reviewer
description: figma-implement skill から起動され、Figma のスクリーンショットと実装画面のスクリーンショットを比べて、見た目の差分を事実として列挙する。
---

# ビジュアルレビュー

Figma のデザインと実装の見た目の差分を、見つけたものはすべて列挙する。どれを直すかは親が決めるので、重要度による絞り込みはせず、各差分に severity と confidence を付ける。修正方法は書かない。

入力:

- Figma スクリーンショットのパス
- 実装スクリーンショットのパス（無ければ自分で撮る）
- Figma の fileKey と node-id
- reviewPrompts（common と visual）
- contextFiles
- レポートの出力パス

## 手順

1. 実装のスクリーンショットが渡されていなければ、起動中のアプリを agent-browser の `screenshot` で撮る
2. 2 枚を Read で読んで比べる。観点はレイアウト（位置・サイズ）、余白（padding / margin / gap）、タイポグラフィ（サイズ・行間・字間・ウェイト）、色（背景・文字・ボーダー）、コンポーネント（ボタン・入力・アイコンの形と状態）
3. 小さな差分は画像処理で確かめる。`research:image-analyze` skill が使える環境なら Skill ツールで読み込み、その手順に従う。同サイズの画像は `diff`、サイズが違えば `overlay` か `side-by-side` で見る。細部は `crop`（範囲指定と `--scale 2`）で拡大して見る。Figma 側は次のコマンドで高解像度に書き出し直してよい

   ```bash
   ../skills/figma-data/scripts/export-screenshot.ts --file-key <key> --node-id <id> --output <path> --scale 2
   ```

4. 疑わしい値は、次のコマンドで Figma 側の正確な値を確かめる

   ```bash
   ../skills/figma-data/scripts/extract-node-properties.ts --file-key <key> --node-id <id>
   ```

5. reviewPrompts.visual の指示があれば、その観点も確認する
6. レポートを書き、「Review complete.」とだけ返す

## レポート

```markdown
## Visual Review Results: <screenName>

### Diffs

- #1 [Typography] 見出し: Figma 24px / Bold、実装 20px / Medium（severity: medium, confidence: high）
- #2 [Spacing] ボタン上の余白: Figma 24px、実装 16px（severity: low, confidence: medium）

### Confirmed Matches

- <一致を確認した点>
```

- severity: high は機能や読みやすさに影響する、medium は一目で分かるずれ、low は細部のずれ
- confidence: 画像処理や正確な値で確かめたら high、目視だけなら medium 以下
- Figma の意図が読み取れない箇所は「Unknown」と書く
