import { execFileSync } from "node:child_process";
import { HookLogger } from "@r_masseater/cc-plugin-lib";

const logger = HookLogger.fromFile(import.meta.filename);

export type RevListStatus = {
  ahead: number;
  behind: number;
};

export type ConflictStatus = {
  hasConflicts: boolean;
  conflictFiles: string[];
};

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf-8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runSafe(command: string, args: string[]): string | undefined {
  try {
    return run(command, args);
  } catch (error) {
    // 失敗は「その情報がない」状態として扱う（upstream 未設定、PR なし、git 管理外、detached HEAD など）。
    // hook は通知だけを担うので、取れない情報は通知しないのが安全なフォールバック。
    logger.debug(
      `${command} ${args.join(" ")} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

export function isGitRepo(): boolean {
  return runSafe("git", ["rev-parse", "--is-inside-work-tree"]) === "true";
}

export function isGitPushCommand(command: string): boolean {
  return /\bgit\s+push\b/.test(command);
}

export function getCurrentBranch(): string | undefined {
  return runSafe("git", ["symbolic-ref", "--short", "HEAD"]);
}

export function getHeadSha(): string | undefined {
  return runSafe("git", ["rev-parse", "HEAD"]);
}

export function getRemoteTrackingBranch(branch: string): string | undefined {
  return runSafe("git", ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]);
}

export function parseRevListCount(result: string): RevListStatus {
  const parts = result.split("\t");
  const behind = Number.parseInt(parts[0] ?? "0", 10);
  const ahead = Number.parseInt(parts[1] ?? "0", 10);
  return { ahead, behind };
}

export function getUnpushedStatus(branch: string, upstream: string): RevListStatus | undefined {
  const result = runSafe("git", ["rev-list", "--left-right", "--count", `${upstream}...${branch}`]);
  if (result === undefined) return undefined;

  return parseRevListCount(result);
}

export function getPrBaseBranch(branch?: string): string | undefined {
  const args = ["pr", "view"];
  if (branch) {
    args.push(branch);
  }
  args.push("--json", "baseRefName", "--jq", ".baseRefName");
  return runSafe("gh", args);
}

const CONFLICT_MARKER_PATTERN = /\+<{7} \.our\n/;
const CONFLICT_FILE_PATTERN =
  /changed in both\n\s+base\s+\d+ [0-9a-f]+ .+\n\s+our\s+\d+ [0-9a-f]+ (.+)\n/g;

export function parseMergeTreeOutput(result: string): ConflictStatus {
  const hasConflicts = CONFLICT_MARKER_PATTERN.test(result);
  const conflictFiles = hasConflicts
    ? [...result.matchAll(CONFLICT_FILE_PATTERN)]
        .map((match) => match[1])
        .filter((file): file is string => Boolean(file))
    : [];
  return { hasConflicts, conflictFiles };
}

export function checkConflictsWithBase(baseBranch: string): ConflictStatus {
  runSafe("git", ["fetch", "origin", baseBranch]);

  const mergeBase = runSafe("git", ["merge-base", "HEAD", `origin/${baseBranch}`]);
  if (mergeBase === undefined) {
    return { hasConflicts: false, conflictFiles: [] };
  }

  const result = runSafe("git", ["merge-tree", mergeBase, "HEAD", `origin/${baseBranch}`]);
  if (result === undefined) {
    return { hasConflicts: false, conflictFiles: [] };
  }

  return parseMergeTreeOutput(result);
}

export type PrConflictStatus = ConflictStatus & {
  baseBranch: string;
};

export function getPrConflictStatus(branch: string): PrConflictStatus | undefined {
  const baseBranch = getPrBaseBranch(branch);
  if (baseBranch === undefined) {
    return undefined;
  }

  return {
    baseBranch,
    ...checkConflictsWithBase(baseBranch),
  };
}

export function formatConflictMessage(
  branch: string,
  baseBranch: string,
  conflictFiles: string[],
): string {
  const files = conflictFiles.length > 0 ? `: ${conflictFiles.join(", ")}` : "";
  return `[git] PR（${branch} → ${baseBranch}）が base と conflict している${files}。解消するまで pull_request トリガーの CI は起動しない。`;
}
