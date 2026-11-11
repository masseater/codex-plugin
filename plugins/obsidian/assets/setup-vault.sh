#!/usr/bin/env bash
# Zettelkasten Vault を冪等にセットアップする。
# 既にあるもの（ディレクトリ・git リポジトリ・pre-commit hook）は変更しない。
set -euo pipefail

VAULT="$HOME/Documents/Zettelkasten"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$VAULT"/{00-Literature-Notes,01-Fleeting-Notes,02-Permanent-Notes,03-Structured-Notes,04-Daily}
cd "$VAULT"

if [ ! -d .git ]; then
  git init -q
  cat > .gitignore << 'GITIGNORE'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/.obsidian-crypt
.trash/
GITIGNORE
  git add -A
  git commit -q -m "Zettelkasten Vault 初期化"
  echo "initialized: $VAULT"
fi

if [ ! -x .git/hooks/pre-commit ]; then
  cp "$SCRIPT_DIR/vault-pre-commit.sh" .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "installed pre-commit hook"
fi

echo "vault ready: $VAULT"
