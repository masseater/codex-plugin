#!/usr/bin/env bun
/**
 * masseater/codex-plugin の各 plugin の AGENTS.md から component-list を読み、
 * キーワードで絞り込んで Markdown で出力する。
 *
 * 使い方: list-components.ts [--root <repo-root>] [keyword ...]
 *
 * リポジトリの場所は次の順に探す:
 *   1. --root
 *   2. cwd の git ルート（このリポジトリやその worktree の中で実行した場合）
 *   3. ~/.claude/plugins/marketplaces/masseater-plugins（marketplace の clone）
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { pathIn } from "../../../hooks/lib/path-in.js";
import { parseArgs } from "node:util";

export type Component = { plugin: string; type: string; name: string; description: string };

const BEGIN_PREFIX = "<!-- BEGIN:component-list";
const END_MARKER = "<!-- END:component-list -->";
const ITEM = /^- \*\*(\w+)\*\* `([^`]+)`(?::\s*(.*))?$/;

/**
 * AGENTS.md の component-list ブロックを読む
 * @param plugin - plugin 名
 * @param text - AGENTS.md の内容
 * @returns コンポーネント一覧
 */
export function parseComponentList(plugin: string, text: string): Component[] {
  const start = text.indexOf(BEGIN_PREFIX);
  const end = text.indexOf(END_MARKER);
  if (start === -1 || end === -1) return [];
  return text
    .slice(start, end)
    .split("\n")
    .map((line) => ITEM.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ plugin, type: m[1]!, name: m[2]!, description: m[3] ?? "" }));
}

/**
 * キーワードのいずれかが plugin 名・名前・説明に含まれるものに絞る（大文字小文字を区別しない）
 * @param components - コンポーネント一覧
 * @param keywords - キーワード
 * @returns 絞り込み結果
 */
export function filterComponents(components: Component[], keywords: string[]): Component[] {
  if (keywords.length === 0) return components;
  const lowered = keywords.map((k) => k.toLowerCase());
  return components.filter((c) => {
    const haystack = `${c.plugin} ${c.name} ${c.description}`.toLowerCase();
    return lowered.some((k) => haystack.includes(k));
  });
}

/**
 * plugin ごとにまとめた Markdown にする
 * @param components - 出力するコンポーネント
 * @returns Markdown
 */
export function formatComponents(components: Component[]): string {
  if (components.length === 0) return "該当するコンポーネントはない。";
  const byPlugin = Map.groupBy(components, (c) => c.plugin);
  return [...byPlugin.entries()]
    .map(([plugin, items]) =>
      [
        `## ${plugin}`,
        ...items.map(
          (c) =>
            `- ${c.type} \`${c.plugin}:${c.name}\`${c.description ? `: ${c.description}` : ""}`,
        ),
      ].join("\n"),
    )
    .join("\n\n");
}

function isRepoRoot(dir: string | undefined): dir is string {
  if (!dir) return false;
  return existsSync(pathIn(dir, "plugins")) && existsSync(pathIn(dir, ".claude-plugin"));
}

function gitRoot(): string | undefined {
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  return git.status === 0 ? git.stdout.trim() : undefined;
}

function marketplaceRoot(): string {
  return pathIn(homedir(), ".claude", "plugins", "marketplaces", "masseater-plugins");
}

/** リポジトリの候補。前から順に、見つかるまで調べる */
const ROOT_CANDIDATES: (() => string | undefined)[] = [gitRoot, marketplaceRoot];

function firstRepoRoot(): string | undefined {
  for (const candidate of ROOT_CANDIDATES) {
    const dir = candidate();
    if (isRepoRoot(dir)) return dir;
  }
  return undefined;
}

function resolveRoot(explicit: string | undefined): string | undefined {
  return explicit || firstRepoRoot();
}

/**
 * 各 plugin の AGENTS.md から component-list を読む
 * @param root - リポジトリのルート
 * @returns 全 plugin のコンポーネント
 */
function readAllComponents(root: string): Component[] {
  const pluginsDir = pathIn(root, "plugins");
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(pathIn(pluginsDir, e.name, "AGENTS.md")))
    .flatMap((e) =>
      parseComponentList(e.name, readFileSync(pathIn(pluginsDir, e.name, "AGENTS.md"), "utf-8")),
    );
}

/**
 * CLI の本体。結果を stdout / stderr に出し、終了コードを返す
 * @param args - コマンドライン引数
 * @returns 終了コード
 */
export function main(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    options: { root: { type: "string" } },
    allowPositionals: true,
  });
  const root = resolveRoot(values.root);
  if (!root) {
    process.stderr.write(
      "masseater/codex-plugin が見つからない。--root <repo-root> で場所を指定する。\n",
    );
    return 1;
  }
  const components = readAllComponents(root);
  process.stdout.write(`${formatComponents(filterComponents(components, positionals))}\n`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
