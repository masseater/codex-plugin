#!/usr/bin/env bun
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { entryPath, expandHome, isInside, vaultPath } from "../lib/home-path.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function noteDirs(vault: string): string[] {
  return readdirSync(vault, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && !dir.name.startsWith("."))
    .map((dir) => entryPath(vault, dir.name));
}

function noteNamesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

export function getAllNotes(): Set<string> {
  const vault = vaultPath();
  if (!existsSync(vault)) return new Set();
  return new Set(noteDirs(vault).flatMap(noteNamesIn));
}

export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    if (match[1]) links.push(match[1].trim());
  }
  return links;
}

function isVaultNote(filePath: string): boolean {
  return isInside(vaultPath(), filePath) && filePath.endsWith(".md") && existsSync(filePath);
}

/**
 * 検査する Vault のノートを決める
 *
 * @param filePath - 編集されたファイル
 * @returns ノートの絶対パス。Vault のノートでなければ undefined
 */
function lintTarget(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const resolved = expandHome(filePath);
  return isVaultNote(resolved) ? resolved : undefined;
}

/**
 * どのノートにも解決しない wikilink を探す
 *
 * @param content - ノートの本文
 * @returns 解決しない wikilink のリンク先
 */
function brokenWikilinks(content: string): string[] {
  const wikilinks = extractWikilinks(content);
  if (wikilinks.length === 0) return [];
  const allNotes = getAllNotes();
  return wikilinks.filter((link) => !allNotes.has(link));
}

const hook = defineHook({
  trigger: {
    PostToolUse: { Write: true, Edit: true },
  },
  run: wrapRun(logger, (context) => {
    const target = lintTarget(context.input.tool_input?.file_path);
    if (!target) return context.success({});

    const broken = brokenWikilinks(readFileSync(target, "utf-8"));
    if (broken.length === 0) return context.success({});

    const fileName = path.basename(target);
    const brokenList = broken.map((b) => `  - [[${b}]]`).join("\n");
    logger.error("Broken wikilinks detected", { file: fileName, broken });

    return context.blockingError(
      `[Vault Lint] ${fileName} の wikilink ${broken.length} 件がどのノートにも解決しない:\n${brokenList}\nリンク先のノートを作るか wikilink を直すと解消する。Vault の pre-commit hook はこの状態の commit を拒否する。`,
    );
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
