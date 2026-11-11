---
name: image-analyze
description: スクリーンショット・デザイン画像をローカルで比較・加工する（ピクセル差分、重ね合わせ、横並べ、エッジ抽出、切り出しと拡大、メタデータ）。「Figma と実装がずれていないか比較して」「スクショの差分を見て」のように画像の比較や細部の確認を頼まれたときに使う。
---

# Image Analyze

画像と PDF は Read で直接読んで判断する。image-process.ts は画像（PNG / JPEG / WebP など）だけを受け付け、PDF は読めない。このスクリプトは、目視では見落とす差分を検出したり、細部を拡大したりするための補助として使う。

## image-process.ts（ローカル処理）

`bun ${CLAUDE_SKILL_DIR}/scripts/image-process.ts <subcommand> ...` で実行する。出力画像は Read で確認する。各サブコマンドの引数は `--help` で確認できる。

- `diff --image1 <a> --image2 <b> [--threshold 0.1] [--output]`: ピクセル差分画像と一致率を出す。2 枚は同じサイズである必要があり、違うとエラーで止まる。サイズが違うときは先に `info` で確認し、書き出し倍率をそろえるか `overlay` / `side-by-side` を使う
- `overlay --image1 <base> --image2 <over> [--opacity 0.5]`: 半透明で重ねる。サイズ差は自動でリサイズされる
- `side-by-side --image1 <left> --image2 <right> [--gap 4]`: 横に並べる。高さは自動でそろえる
- `edge --image <img>`: Sobel フィルタでエッジを抽出する。色を無視してレイアウト構造だけを比べたいときに使う
- `crop --image <img> --left <x> --top <y> --width <w> --height <h> [--scale 1]`: 領域を切り出し、`--scale` で拡大する。余白・ボーダー・小さな文字など、全体画像では読み取りにくい細部を確かめるときに使う
- `info --image <img>`: サイズ・形式・色空間・DPI・アルファの有無を表示する

出力先を省略すると、入力と同じディレクトリに `<name>_<subcommand>.png`（side-by-side は `<name>_sidebyside.png`）で保存される。

## image-analyze.ts（任意: Gemini による解析）

`GEMINI_API_KEY`（または `GOOGLE_API_KEY`）が設定されていて、ユーザーが Gemini での解析を求めたときだけ使う。

```bash
bun ${CLAUDE_SKILL_DIR}/scripts/image-analyze.ts --input <image|pdf> [--compare <image|pdf>] [-p "<prompt>"]
```
