#!/usr/bin/env bash
# Install plugin transitive deps inside CLAUDE_PLUGIN_ROOT (Claude Code's cache dir).
set -euo pipefail
[ -n "${CLAUDE_PLUGIN_ROOT:-}" ] || exit 0
cd ".."
[ -f node_modules/.cc-installed ] && exit 0
node -e 'var f=require("fs"),p=JSON.parse(f.readFileSync("package.json","utf8"));delete p.devDependencies;f.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
rm -f bun.lock
bun install --production
mkdir -p node_modules
touch node_modules/.cc-installed
