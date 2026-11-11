---
name: codex-guide
description: Claude Code から OpenAI Codex CLI（codex exec / codex review）を呼び出す方法。用途は計画やコードのセカンドオピニオンを得ることと、単発タスクや画像生成を任せることである。Codex でレビューしたいとき、Codex の使い方や設定を聞かれたときに使う。
allowed-tools: Bash(codex --version), Bash(codex --version *), Bash(echo *)
---

# Codex CLI の使い方

現在の環境:

```!
codex --version 2>/dev/null || echo "codex は未インストール"
```

Claude Code からは非対話の `codex exec` を使う。`codex "prompt"` は TUI を開くので使えない。サブコマンドとオプションは変わりやすいので、不明な点は `codex --help` / `codex exec --help` で確かめる。

## レビューを依頼する

```bash
cat <file> | codex exec -s read-only -o <output-file> "<レビュー指示>" > <log-file> 2>&1
```

- Bash ツールの `run_in_background: true` で起動する。Codex は数分考えることがあり、フォアグラウンドだと Bash のタイムアウト（既定 2 分）で結果を取り逃すため。完了通知を待つ間は別の作業を進めてよい
- 結果は `-o` で指定したファイルだけを読む。ログには思考過程やツール呼び出しが大量に入るので、Codex の失敗を調べるとき以外は読まない
- stdin に流した内容は、プロンプトの後ろに `<stdin>` ブロックとして付く
- 繰り返し依頼するときは、出力とログのファイル名を回ごとに分けて前回の結果を残す

diff のレビューには専用のサブコマンドもある: `codex review --base main` / `--uncommitted` / `--commit <sha>`。

## 助言の扱い

Codex の指摘は助言であり、採否は自分で判断する。AGENTS.md のルールやユーザーと合意した決定に反する助言は採らない。採用した助言を反映したら、その内容を報告する。反映結果を Codex に再レビューさせるのは、ユーザーが求めたときか、反映が大きく設計を変えたときだけにする。

Codex が未インストール・未ログイン・タイムアウト・非 0 終了のときは、理由を記録して自分でレビューして先へ進む。Codex の失敗で作業を止めない。

## その他の使い方

- 単発タスク: `codex exec -s workspace-write -o result.txt "<指示>"`。ファイルを書かせるときは `workspace-write`、分析だけなら `read-only`。`danger-full-access` はユーザーが求めたときだけ
- 画像入力: `codex exec -i screenshot.png "<指示>"`
- 画像生成: Codex はラスター画像（PNG）を生成できる。プロンプトに「画像生成ツールを使用して」と明示しないと、SVG や matplotlib などのコード生成に逃げる。保存させるので `-s workspace-write` を付ける

  ```bash
  codex exec -s workspace-write -o result.txt "画像生成ツールを使用して、<内容> の画像を生成し、<path> に保存して"
  ```

## 設定

- 全体設定は `~/.codex/config.toml`、プロジェクト設定は `.codex/config.toml`。`model`、`model_reasoning_effort`、`sandbox_mode` などを置く
- 1 回だけ上書きするときは `-c key=value`（例: `codex exec -c model_reasoning_effort="high" ...`）
- Codex もプロジェクトの AGENTS.md を読む
