#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

function gitSafe(...args: string[]): string | undefined {
  try {
    return git(...args);
  } catch {
    return undefined;
  }
}

function isGitRepo(): boolean {
  return gitSafe("rev-parse", "--is-inside-work-tree") === "true";
}

function getCurrentBranch(): string | undefined {
  return gitSafe("symbolic-ref", "--short", "HEAD");
}

function getRemoteTrackingBranch(branch: string): string | undefined {
  return gitSafe("rev-parse", "--abbrev-ref", `${branch}@{upstream}`);
}

/** Check if local branch has unpushed commits compared to remote */
export function parseRevListCount(result: string): { ahead: number; behind: number } {
  const parts = result.split("\t");
  const behind = Number.parseInt(parts[0] ?? "0", 10);
  const ahead = Number.parseInt(parts[1] ?? "0", 10);
  return { ahead, behind };
}

/** Check if local branch has unpushed commits compared to remote */
function getUnpushedStatus(
  branch: string,
  upstream: string,
): { ahead: number; behind: number } | undefined {
  const result = gitSafe("rev-list", "--left-right", "--count", `${upstream}...${branch}`);
  if (result === undefined) return undefined;

  return parseRevListCount(result);
}

/** Find the PR base branch using gh CLI */
function getPrBaseBranch(): string | undefined {
  try {
    const result = execFileSync(
      "gh",
      ["pr", "view", "--json", "baseRefName", "--jq", ".baseRefName"],
      { encoding: "utf-8", timeout: 10_000 },
    ).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

export function parseMergeTreeOutput(result: string): {
  hasConflicts: boolean;
  conflictFiles: string[];
} {
  const conflictPattern = /\+<{7} \.our\n/g;
  const hasConflicts = conflictPattern.test(result);

  const conflictFiles: string[] = [];
  if (hasConflicts) {
    const filePattern =
      /changed in both\n\s+base\s+\d+ [0-9a-f]+ .+\n\s+our\s+\d+ [0-9a-f]+ (.+)\n/g;
    let match: RegExpExecArray | null;
    while (true) {
      match = filePattern.exec(result);
      if (match === null) break;
      if (match[1]) {
        conflictFiles.push(match[1]);
      }
    }
  }

  return { hasConflicts, conflictFiles };
}

/** Check if current branch has merge conflicts with base branch */
function checkConflictsWithBase(baseBranch: string): {
  hasConflicts: boolean;
  conflictFiles: string[];
} {
  gitSafe("fetch", "origin", baseBranch);

  const mergeBase = gitSafe("merge-base", "HEAD", `origin/${baseBranch}`);
  if (mergeBase === undefined) {
    return { hasConflicts: false, conflictFiles: [] };
  }

  const result = gitSafe("merge-tree", mergeBase, "HEAD", `origin/${baseBranch}`);
  if (result === undefined) {
    return { hasConflicts: false, conflictFiles: [] };
  }

  return parseMergeTreeOutput(result);
}

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    if (context.input.stop_hook_active) {
      logger.debug("Skipping: already blocked once this turn");
      return context.success({});
    }

    if (!isGitRepo()) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    const branch = getCurrentBranch();
    if (branch === undefined) {
      logger.debug("Skipping: detached HEAD");
      return context.success({});
    }

    const messages: string[] = [];

    // 1. Check remote integration status
    const upstream = getRemoteTrackingBranch(branch);
    if (upstream === undefined) {
      messages.push(
        `[git] Branch "${branch}" has no remote tracking branch. Consider pushing with: git push -u origin ${branch}`,
      );
    } else {
      const status = getUnpushedStatus(branch, upstream);
      if (status !== undefined) {
        if (status.ahead > 0) {
          messages.push(
            `[git] Branch "${branch}" is ${status.ahead} commit(s) ahead of ${upstream}. Unpushed changes exist.`,
          );
        }
        if (status.behind > 0) {
          messages.push(
            `[git] Branch "${branch}" is ${status.behind} commit(s) behind ${upstream}. Consider pulling.`,
          );
        }
        if (status.ahead === 0 && status.behind === 0) {
          logger.debug(`Branch "${branch}" is up to date with ${upstream}`);
        }
      }
    }

    // 2. Check PR base branch conflicts
    const baseBranch = getPrBaseBranch();
    if (baseBranch !== undefined) {
      logger.debug(`PR base branch: ${baseBranch}`);
      const { hasConflicts, conflictFiles } = checkConflictsWithBase(baseBranch);
      if (hasConflicts) {
        const fileList = conflictFiles.length > 0 ? ` Files: ${conflictFiles.join(", ")}` : "";
        messages.push(
          `[git] Branch "${branch}" has merge conflicts with PR base branch "${baseBranch}".${fileList} Resolve conflicts before merging.`,
        );
      } else {
        logger.debug(`No conflicts with base branch "${baseBranch}"`);
      }
    } else {
      logger.debug("No PR found for current branch");
    }

    if (messages.length === 0) {
      logger.info("Branch status: all clear");
      return context.success({});
    }

    const reason = messages.join("\n");
    logger.info(`Branch status notifications:\n${reason}`);

    return context.json({
      event: "Stop",
      output: {
        decision: "block",
        reason,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
