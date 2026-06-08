#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: codex-hook-runner.sh <hook.ts> [args...]" >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
HOOK_PATH="$1"
shift
STDIN_FILE="$(mktemp "${TMPDIR:-/tmp}/codex-hook-stdin.XXXXXX")"
trap 'rm -f "$STDIN_FILE"' EXIT
cat > "$STDIN_FILE"

case "$HOOK_PATH" in
  /*) ;;
  *) HOOK_PATH="$PLUGIN_ROOT/${HOOK_PATH#./}" ;;
esac

export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$PLUGIN_ROOT}"
export PATH="$HOME/.local/share/mise/shims:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if command -v bun >/dev/null 2>&1; then
  BUN_BIN="$(command -v bun)"
else
  echo "error: bun is required to run Codex plugin hooks but was not found in PATH" >&2
  exit 127
fi

cd "$PLUGIN_ROOT"

if [ -f package.json ] && [ ! -f node_modules/.codex-installed ]; then
  PACKAGE_JSON_BACKUP="$(mktemp "${TMPDIR:-/tmp}/codex-hook-package.XXXXXX")"
  cp package.json "$PACKAGE_JSON_BACKUP"
  BUN_LOCK_BACKUP=""
  BUN_LOCK_EXISTED=0
  if [ -f bun.lock ]; then
    BUN_LOCK_BACKUP="$(mktemp "${TMPDIR:-/tmp}/codex-hook-bun-lock.XXXXXX")"
    cp bun.lock "$BUN_LOCK_BACKUP"
    BUN_LOCK_EXISTED=1
  fi

  "$BUN_BIN" -e 'const fs = require("fs"); const p = JSON.parse(fs.readFileSync("package.json", "utf8")); delete p.devDependencies; fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");'
  rm -f bun.lock
  if "$BUN_BIN" install --production >/dev/null 2>&1; then
    INSTALL_STATUS=0
  else
    INSTALL_STATUS=$?
  fi
  cp "$PACKAGE_JSON_BACKUP" package.json
  if [ "$BUN_LOCK_EXISTED" -eq 1 ]; then
    cp "$BUN_LOCK_BACKUP" bun.lock
  else
    rm -f bun.lock
  fi
  rm -f "$PACKAGE_JSON_BACKUP" "$BUN_LOCK_BACKUP"
  if [ "$INSTALL_STATUS" -ne 0 ]; then
    echo "error: failed to install Codex plugin hook dependencies" >&2
    exit "$INSTALL_STATUS"
  fi
  mkdir -p node_modules
  touch node_modules/.codex-installed
fi

"$BUN_BIN" -e 'const fs = require("fs"); const file = process.argv[1]; try { const input = fs.readFileSync(file, "utf8"); const payload = JSON.parse(input || "{}"); if (payload && payload.hook_event_name === "PostToolUse" && payload.tool_response === undefined) { payload.tool_response = {}; fs.writeFileSync(file, JSON.stringify(payload)); } } catch {}' "$STDIN_FILE"

cat "$STDIN_FILE" | "$BUN_BIN" "$HOOK_PATH" "$@"
