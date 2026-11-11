#!/usr/bin/env bash
# SessionStart ラッパー: install-deps → 旧キャッシュ削除 → .ts hook を sequential に実行する。
# Claude Code は SessionStart の全 hook を並列実行するため、install-deps.sh と
# .ts hook を別グループに分けても順序保証がない。このラッパーで単一エントリポイント化する。
#
# mutils は SessionStart に 2 つの .ts hook を持つため、stdin を保存して順次実行する。
# check-install は install 直後は常に成功するが、2 回目以降のセッションで
# bun.lock と node_modules の鮮度チェックを行うため残す。
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$PLUGIN_ROOT" ] || exit 0

# --- 依存インストール ---
"${PLUGIN_ROOT}/hooks/install-deps.sh"

# --- 旧バージョンのキャッシュ削除（plugin キャッシュ内で動いているときだけ）---
# BEGIN plugin-cache-guard
# plugin キャッシュ（<設定ディレクトリ>/plugins/cache/<marketplace>/<plugin>/<version>）の中で動いているかを判定する。
# キャッシュ外（--plugin-dir でリポジトリの plugin を直接読み込んだ場合など）では、依存インストールと
# 旧バージョン削除をしない。リポジトリの package.json・bun.lock や隣の plugin ディレクトリを書き換えないため。
is_plugin_cache() {
  local cache_root
  cache_root=$(dirname "$(dirname "$(dirname "$1")")")
  [ "$(basename "$cache_root")" = "cache" ] && [ "$(basename "$(dirname "$cache_root")")" = "plugins" ]
}
# END plugin-cache-guard
if is_plugin_cache "$PLUGIN_ROOT"; then
  CACHE_DIR=$(dirname "$PLUGIN_ROOT")
  CURRENT_VERSION=$(basename "$PLUGIN_ROOT")
  for d in "$CACHE_DIR"/*/; do
    [ ! -d "$d" ] && continue
    [ "$(basename "$d")" = "$CURRENT_VERSION" ] && continue
    rm -rf "$d"
  done
fi

# --- 複数 hook を順次実行 ---
STDIN_FILE=$(mktemp)
trap 'rm -f "$STDIN_FILE"' EXIT
cat > "$STDIN_FILE"

# check-install / check-context-version: 問題があるときだけ systemMessage（ユーザー向け）を出力する。
OUT1=$(bun "${PLUGIN_ROOT}/hooks/entry/check-install.ts" < "$STDIN_FILE") || true
OUT2=$(bun "${PLUGIN_ROOT}/hooks/entry/check-context-version.ts" < "$STDIN_FILE") || true

# 出力のマージ: 非空の出力が 1 つならそのまま使う。両方あれば
# トップレベルの systemMessage と hookSpecificOutput.additionalContext をそれぞれ連結する。
if [ -z "$OUT1" ] && [ -z "$OUT2" ]; then
  exit 0
elif [ -z "$OUT1" ]; then
  printf '%s\n' "$OUT2"
elif [ -z "$OUT2" ]; then
  printf '%s\n' "$OUT1"
else
  bun "${PLUGIN_ROOT}/hooks/lib/merge-session-start-output.ts" "$OUT1" "$OUT2"
fi
