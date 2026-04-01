---
name: agnix:agnix
description: AI コーディングアシスタント設定ファイルのリンター。CLAUDE.md, AGENTS.md, SKILL.md, hooks.json, MCP設定等を検証し、ベストプラクティス違反を検出・自動修正する。
---

# agnix

AI コーディングアシスタント設定ファイルのリンター。`/agnix:lint` で検証、`/agnix:setup` でインストール。

## サブコマンド

### /agnix:lint

設定ファイルを lint する。

```bash
# カレントディレクトリを claude-code 向けに検証
agnix --target claude-code .

# 特定ファイルを検証
agnix --target claude-code CLAUDE.md

# 自動修正（HIGH + MEDIUM confidence）
agnix --target claude-code --fix .

# 安全な修正のみ（HIGH confidence）
agnix --target claude-code --fix-safe .

# 修正プレビュー（dry-run）
agnix --dry-run --show-fixes --target claude-code .

# 警告もエラーとして扱う
agnix --target claude-code --strict .
```

**引数:**
| オプション | 説明 |
|-----------|------|
| `--target <tool>` | 対象ツール（claude-code, cursor, copilot, mcp, agents-md, agent-skills, gemini-cli） |
| `--fix` | HIGH + MEDIUM confidence の自動修正を適用 |
| `--fix-safe` | HIGH confidence のみ修正 |
| `--fix-unsafe` | 全 confidence レベルの修正を適用 |
| `--dry-run --show-fixes` | 修正のプレビュー（差分表示） |
| `--strict` | 警告をエラーとして扱う |

`--target` 未指定時は全ターゲットが対象になる。Claude Code プロジェクトでは `--target claude-code` を推奨。

### /agnix:setup

agnix をインストールする。

```bash
# npm（推奨）
npm install -g agnix

# Homebrew
brew tap avifenesh/agnix && brew install agnix

# Cargo
cargo install agnix-cli
```

インストール確認:

```bash
agnix --version
```

## 対象ファイル

agnix が検証する設定ファイル:

- `CLAUDE.md`, `AGENTS.md`, `SKILL.md`
- `hooks.json`, `plugin.json`, `settings.json`
- `*.mcp.json`
- `.claude/rules/*.md`

## ルール数

169 ルール（Claude Code: 53, Agent Skills: 31, AGENTS.md: 13, MCP: 12, Cursor: 10, Copilot: 6, Gemini CLI: 3 等）

## CI

GitHub Actions で CI に組み込める:

```yaml
- uses: avifenesh/agnix@v0
  with:
    target: claude-code
```
