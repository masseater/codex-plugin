import { execFileSync, spawnSync } from "node:child_process";

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
  }).trim();
}

function runSafe(command: string, args: string[]): string | undefined {
  try {
    return run(command, args);
  } catch {
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

export function parseMergeTreeOutput(result: string): ConflictStatus {
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

export type PullResult = { ok: true; pulled: number } | { ok: false; reason: string };

export function tryFastForwardPull(behind: number): PullResult {
  const result = spawnSync("git", ["pull", "--ff-only", "--no-rebase"], {
    encoding: "utf-8",
    timeout: 30_000,
  });

  if (result.status === 0) {
    return { ok: true, pulled: behind };
  }

  const stderr = (result.stderr ?? "").trim();
  const stdout = (result.stdout ?? "").trim();
  return { ok: false, reason: stderr || stdout || "git pull --ff-only failed" };
}

export function formatPullFailureMessage(
  branch: string,
  upstream: string,
  behind: number,
  reason: string,
): string {
  return [
    `[git] Auto-pull failed: branch "${branch}" is ${behind} commit(s) behind ${upstream} and cannot fast-forward.`,
    `[git] Reason: ${reason}`,
    `[git] Resolve it.`,
  ].join("\n");
}

export function formatConflictResolutionMessage(
  branch: string,
  baseBranch: string,
  conflictFiles: string[],
): string {
  const lines = [
    `[git] The pushed branch "${branch}" already has an open PR and has merge conflicts with its base branch "${baseBranch}".`,
  ];

  if (conflictFiles.length > 0) {
    lines.push(`[git] Conflicted files: ${conflictFiles.join(", ")}`);
  }

  lines.push(`[git] Resolve by merging the base branch:`);
  lines.push(`[git]   git fetch origin ${baseBranch} && git merge origin/${baseBranch}`);
  lines.push(
    `[git] After fixing conflicts, run git add <files>, git merge --continue, then push again.`,
  );

  return lines.join("\n");
}
