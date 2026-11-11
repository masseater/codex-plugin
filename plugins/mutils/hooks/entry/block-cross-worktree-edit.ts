#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { denyToolUse } from "../lib/pre-tool-use.js";

using logger = HookLogger.fromFile(import.meta.filename);

export const parseWorktreeList = (porcelain: string): string[] => {
  const paths: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice("worktree ".length).trim());
    }
  }
  return paths;
};

const listWorktrees = (cwd: string): string[] => {
  try {
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseWorktreeList(out);
  } catch (error) {
    // git 管理外や git が無い環境では worktree を判定できない。そのときは編集を止めずに通すだけなので安全
    logger.debug(`git worktree list failed: ${String(error)}`);
    return [];
  }
};

export const isUnder = (filePath: string, dir: string): boolean => {
  if (filePath === dir) return true;
  const rel = relative(dir, filePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

export const findContainingWorktree = (filePath: string, worktrees: string[]): string | null => {
  const sorted = [...worktrees].toSorted((a, b) => b.length - a.length);
  for (const wt of sorted) {
    if (isUnder(filePath, wt)) return wt;
  }
  return null;
};

/**
 * deny の理由文
 *
 * @param filePath - 編集しようとしたファイル
 * @param target - そのファイルを含む worktree
 * @param cwd - このセッションの cwd
 * @returns permissionDecisionReason の文字列
 */
export function formatDenyReason(filePath: string, target: string, cwd: string): string {
  return [
    `別の git worktree のファイルへの編集を止めた（file: ${filePath} / worktree: ${target} / cwd: ${cwd}）。`,
    "他の worktree では別のブランチの作業が進んでいることがあり、外から書き換えるとその作業を壊すため。",
    `${target} で編集するなら、EnterWorktree ツールでこのセッションをその worktree に移してから編集する。`,
  ].join("\n");
}

/**
 * 編集を止めるべき worktree を探す。ファイルがこのセッションの外の worktree にあるときだけ返す
 *
 * @param filePath - 編集しようとしたファイルの絶対パス
 * @param cwd - このセッションの cwd
 * @returns ファイルを含む別の worktree。止める必要が無ければ null
 */
function blockingWorktree(filePath: string, cwd: string): string | null {
  const target = findContainingWorktree(filePath, listWorktrees(cwd));
  if (target === null || isUnder(cwd, target)) return null;
  return target;
}

function absolutePath(filePath: string, cwd: string): string {
  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input?.tool_input.file_path) {
      return context.success({});
    }

    const cwd = input.cwd;
    const filePath = absolutePath(input.tool_input.file_path, cwd);
    const target = blockingWorktree(filePath, cwd);
    if (target === null) {
      return context.success({});
    }

    logger.warn("Blocked cross-worktree edit", { filePath, target, cwd });
    return context.json(denyToolUse(formatDenyReason(filePath, target, cwd)));
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
