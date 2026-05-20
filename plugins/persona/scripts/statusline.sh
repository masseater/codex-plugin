#!/usr/bin/env bash
# persona statusline — 現在のペルソナを Claude Code の statusline に表示する。
#
# Claude Code の statusLine 機能（公式 docs: code.claude.com/docs/en/statusline）は
# stdin に session 情報の JSON を渡してくる。ここから session_id を取り出し、
# 対応する state ファイルから persona を読んで出力する。
#
# wire-up 例（~/.claude/settings.json）:
#   {
#     "statusLine": {
#       "type": "command",
#       "command": "$HOME/.claude/plugins/marketplaces/<your-marketplace>/plugins/persona/scripts/statusline.sh"
#     }
#   }
#
# 依存: jq

set -euo pipefail

input="$(cat)"
session_id="$(printf '%s' "$input" | jq -r '.session_id // empty')"
project_dir="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // empty')"
project_dir="${project_dir:-${CLAUDE_PROJECT_DIR:-${PWD}}}"

if [[ -z "$session_id" ]]; then
  exit 0
fi

state_file="${project_dir}/.agents/tmp/persona/${session_id}"
[[ -f "$state_file" ]] || exit 0

persona="$(tr -d '[:space:]' < "$state_file" 2>/dev/null || true)"
case "$persona" in
  planner) printf '🧭 planner' ;;
  worker)  printf '🔨 worker'  ;;
  *)       printf '· persona?' ;;
esac
