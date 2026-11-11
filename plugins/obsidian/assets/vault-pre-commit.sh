#!/usr/bin/env bash
# Zettelkasten Vault の pre-commit hook
# コミット対象の .md ファイルに壊れた wikilink がないか検証し、あればコミットを拒否する
set -euo pipefail

VAULT_ROOT="$(git rev-parse --show-toplevel)"

collect_all_notes() {
  find "$VAULT_ROOT" -mindepth 2 -maxdepth 2 -name '*.md' -not -path '*/.obsidian/*' -not -path '*/.trash/*' \
    | while read -r f; do basename "$f" .md; done \
    | sort -u
}

ALL_NOTES="$(collect_all_notes)"
ERRORS=()

for file in $(git diff --cached --name-only --diff-filter=ACM -- '*.md'); do
  filepath="$VAULT_ROOT/$file"
  [ -f "$filepath" ] || continue

  while IFS= read -r link; do
    [ -z "$link" ] && continue
    if ! echo "$ALL_NOTES" | grep -qxF "$link"; then
      ERRORS+=("$file: [[${link}]]")
    fi
  done < <(grep -oE '\[\[([^]|]+)(\|[^]]+)?\]\]' "$filepath" | sed 's/\[\[//;s/\]\]//;s/|.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
done

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "壊れた wikilink が検出されました。コミットを中止します。" >&2
  echo "" >&2
  for err in "${ERRORS[@]}"; do
    echo "  $err" >&2
  done
  echo "" >&2
  echo "リンク先のノートを作成するか、wikilink を修正してください。" >&2
  exit 1
fi
