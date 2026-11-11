#!/usr/bin/env bash
# SessionStart ラッパー: install-deps → 旧キャッシュ削除 → .ts hook を sequential に実行する。
# Claude Code は SessionStart の全 hook を並列実行するため、install-deps.sh と
# .ts hook を別グループに分けても順序保証がない。このラッパーで単一エントリポイント化する。
#
# 本テンプレートは SessionStart で単一の entry hook のみを実行するプラグイン専用。
# 末尾の exec 行の announce-persona を各プラグインの entry hook 名に置換して使用する。
# mutils のように SessionStart で複数の .ts hook を順次実行し出力をマージする
# プラグインは分岐処理が本質的に異なるため対象外とし、
# plugins/mutils/hooks/session-start-wrapper.sh を個別ファイルとして維持する。
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

# --- hook 実行（exec で stdin/stdout をパススルー）---
exec bun "${PLUGIN_ROOT}/hooks/entry/announce-persona.ts"
