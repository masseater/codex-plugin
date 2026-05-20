---
description: ペルソナを worker に切り替える
---

!mkdir -p "$CLAUDE_PROJECT_DIR/.agents/tmp/persona" && echo worker > "$CLAUDE_PROJECT_DIR/.agents/tmp/persona/$CLAUDE_CODE_SESSION_ID"

ペルソナを **worker** に切り替えた（このセッションのみ）。次のプロンプトから worker として振る舞う。
