#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const parseWorktreeList = (porcelain: string): string[] => {
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
  } catch {
    return [];
  }
};

const isUnder = (filePath: string, dir: string): boolean => {
  if (filePath === dir) return true;
  const rel = relative(dir, filePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

const findContainingWorktree = (filePath: string, worktrees: string[]): string | null => {
  const sorted = [...worktrees].toSorted((a, b) => b.length - a.length);
  for (const wt of sorted) {
    if (isUnder(filePath, wt)) return wt;
  }
  return null;
};

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const cwd = input.cwd;
    const rawFilePath = input.tool_input.file_path;
    if (!rawFilePath) {
      return context.success({});
    }

    const filePath = isAbsolute(rawFilePath) ? rawFilePath : resolve(cwd, rawFilePath);
    const worktrees = listWorktrees(cwd);
    if (worktrees.length === 0) {
      return context.success({});
    }

    const target = findContainingWorktree(filePath, worktrees);
    if (target === null) {
      return context.success({});
    }

    if (isUnder(cwd, target) || cwd === target) {
      return context.success({});
    }

    const reason = `Edit blocked: file belongs to a different git worktree.

  file:     ${filePath}
  worktree: ${target}
  cwd:      ${cwd}

FIX: Use the EnterWorktree tool to switch this session into ${target} before editing files there. Editing across worktrees risks corrupting the other worktree's in-progress branch.`;

    logger.warn("Blocked cross-worktree edit", { filePath, target, cwd });

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: reason,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
