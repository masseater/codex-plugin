---
name: session-conflict
description: 同じリポジトリで並行稼働する他の Claude Code セッションとの競合を、ccsight で相手の状態を確認し宣言ブロックで合意してから解消する手順。merge conflict・予期しない差分・lock 待ち・push reject・未取得のリモートコミットなどに遭遇したときに使う。
---

# 並行セッションとの競合解消

他セッションの未完作業を上書きせずに競合を解消する。どのセッションも競合時に `mcp__ccsight__live_sessions` / `mcp__ccsight__sessions` を参照する前提なので、assistant メッセージに宣言ブロックを書けば相手に意図が伝わる。`AskUserQuestion` は以下を試しても進めない場合の最終手段にする。

## 手順

1. `mcp__ccsight__live_sessions` で、同じリポジトリ・ワークスペース・ブランチで稼働中のセッションを確かめる。確かめる前に reset・force push・上書き・rebase で解消しない
2. 稼働中のセッションがあれば、`mcp__ccsight__sessions` でその最終ターン・編集中のファイル・実行中のコマンド・TODO・既出の宣言ブロックを取得し、下の判定で方針を決める
3. 方針を決めたら、宣言ブロックを、相手の状態を確かめる次の `mcp__ccsight__sessions` 呼び出しと同じメッセージに書く。本文だけのメッセージにするとそこでターンが終わり、相手の応答を確かめられない。相手の応答（acknowledge / counter-claim / 無応答）に応じて進める
4. 稼働中のセッションがなければ、差分の出自を `git log` / `git reflog` / `mcp__ccsight__sessions`（直近の終了済みセッション）で特定してから対応する
5. 競合が解消したら（書き込み完了・待機解除・引き継ぎ完了・中止確定）、`intent: 解除` の宣言ブロックを次のツール呼び出しと同じメッセージに書き、先の宣言を無効にする。送信済みのメッセージは消せず、古い宣言が残ったままだと他セッションを誤誘導するため

## 方針の判定

「進行中」は最終アクティビティが 10 分以内、「完了済み」は 10 分以上前かつ TODO が完了しているものとする。

```pseudocode
other = ccsight.sessions(target)
if other.edits_same(file or symbol or branch) and other.in_progress:
    stop writing; wait  # 下の「待ち方」で live_sessions を再確認し、10 分無活動か TODO 完了で再判定
    # 別ブランチや別 worktree へ逃がさない。分断は後で結合する手間を生むだけ
elif other.same_repo and other.edits_different(files or dirs or worktree):
    continue, but run git status / git fetch before each write
elif other.same_branch and other.finished:
    git fetch; git merge; then resume writing
elif other.same_branch and other.stopped:  # エラー・入力待ち・確認待ち
    take over its last TODO, diff, and error log; continue in this session
else:
    AskUserQuestion with the situation and what was tried
```

## 待ち方

フォアグラウンドの `sleep` は使えず、本文だけのメッセージでターンを終えると作業が止まる。待つときは、メイン会話なら `ScheduleWakeup`（数分後に再開）、サブエージェントなら `Monitor` で、間隔を空けて `mcp__ccsight__live_sessions` を再確認する。

## 宣言ブロック

コードブロック内に次の形式で書く。

```text
<!-- xsession-instruction -->
from: ${CLAUDE_SESSION_ID}
to: <対象セッション ID>
claim: <これから書き込む対象（ファイル / シンボル / ブランチ）>
intent: <待機 | 続行 | 引き継ぎ | 中止 | 解除>
request: <相手への依頼。例: 同一ファイルの編集を保留してほしい / 先に commit・push して終了してほしい>
deadline: <例: 10 分以内に応答がなければこちらが続行する>
<!-- /xsession-instruction -->
```
