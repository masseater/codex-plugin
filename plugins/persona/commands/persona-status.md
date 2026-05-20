---
description: 現在のペルソナを表示する
---

!f="$CLAUDE_PROJECT_DIR/.agents/tmp/persona/$CLAUDE_CODE_SESSION_ID"; if [ -f "$f" ]; then printf 'persona: %s\n' "$(cat "$f")"; else echo 'persona: (未設定)'; fi

上記が現在のペルソナ状態です。
