#!/usr/bin/env bash
# Install plugin transitive deps inside CLAUDE_PLUGIN_ROOT (Claude Code's cache dir).
#
# Why: Claude Code copies plugins by resolving symlinks in plugins/*/node_modules/.
# bun isolated linker stores transitive deps in node_modules/.bun/<pkg>+<hash>/node_modules/,
# which are siblings — never copied. So we re-run `bun install` inside the cache
# to materialize a self-contained node_modules tree.
set -euo pipefail
[ -n "${CLAUDE_PLUGIN_ROOT:-}" ] || exit 0
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
is_plugin_cache ".." || exit 0
cd ".."
[ -f node_modules/.cc-installed ] && exit 0
# Strip devDependencies — they may reference workspace:* paths unreachable from cache.
node -e 'var f=require("fs"),p=JSON.parse(f.readFileSync("package.json","utf8"));delete p.devDependencies;f.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
# Drop the bundled bun.lock — it mirrors the workspace's isolated layout and will
# mismatch the stripped package.json, causing bun to bail with "lockfile is frozen".
rm -f bun.lock
# SessionStart hook の stdout はモデルのコンテキストや hook の JSON 出力として解釈されるため、
# インストールログは stderr に流す。
bun install --production >&2
mkdir -p node_modules
touch node_modules/.cc-installed
