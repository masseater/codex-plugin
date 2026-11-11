#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  checkConflictsWithBase,
  formatConflictMessage,
  getCurrentBranch,
  getPrBaseBranch,
  getRemoteTrackingBranch,
  getUnpushedStatus,
  isGitRepo,
  parseMergeTreeOutput,
  parseRevListCount,
} from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

export type BranchState = {
  branch: string;
  upstream: string | undefined;
  ahead: number;
  behind: number;
  conflict: { baseBranch: string; files: string[] } | undefined;
};

/**
 * 通知の要否を決めるキー。コミット数そのものではなく「先行 / 遅れ / conflict があるか」の変化だけを見る。
 * コミットのたびに通知が出て、作業途中の push を促すのを避けるため。
 *
 * @param state - 現在のブランチ状態
 * @returns 前回通知時と比較するための文字列
 */
export function stateKey(state: BranchState): string {
  return JSON.stringify({
    branch: state.branch,
    hasUpstream: state.upstream !== undefined,
    ahead: state.ahead > 0,
    behind: state.behind > 0,
    conflictBase: state.conflict?.baseBranch ?? null,
  });
}

/**
 * upstream との差（未 push・未取り込み）を表す行を作る。
 *
 * @param state - 現在のブランチ状態
 * @returns 通知する行
 */
function upstreamLines(state: BranchState): string[] {
  const { branch, upstream, ahead, behind } = state;
  if (upstream === undefined) return [`[git] ${branch}: upstream 未設定（未 push）`];
  return [
    ...(ahead > 0 ? [`[git] ${branch}: ${upstream} より ${ahead} コミット先行（未 push）`] : []),
    ...(behind > 0
      ? [`[git] ${branch}: ${upstream} より ${behind} コミット遅れている（未取り込み）`]
      : []),
  ];
}

export function formatBranchState(state: BranchState): string[] {
  const { branch, conflict } = state;
  return [
    ...upstreamLines(state),
    ...(conflict ? [formatConflictMessage(branch, conflict.baseBranch, conflict.files)] : []),
  ];
}

function stateFilePath(sessionId: string): string {
  const stateHome = process.env["XDG_STATE_HOME"] || join(homedir(), ".local", "state");
  const dir = join(stateHome, "masseater-plugins", "github-workflow", "branch-status");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${sessionId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

function readLastKey(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    // セッションで初めての Stop ではファイルがない。前回の通知なしとして扱えばよい
    logger.debug(`No previous branch state: ${String(error)}`);
    return undefined;
  }
}

/**
 * upstream に対する先行・遅れのコミット数を数える。
 *
 * @param branch - 現在のブランチ
 * @param upstream - 追跡しているリモートブランチ
 * @returns 先行・遅れのコミット数。upstream が無いか数えられなければ 0
 */
function aheadBehind(
  branch: string,
  upstream: string | undefined,
): { ahead: number; behind: number } {
  const counts = upstream === undefined ? undefined : getUnpushedStatus(branch, upstream);
  return counts ?? { ahead: 0, behind: 0 };
}

/**
 * PR の base ブランチとの conflict を調べる。
 *
 * @param branch - 現在のブランチ
 * @returns conflict があれば base ブランチと conflict しているファイル。PR が無いか conflict が無ければ undefined
 */
function conflictWithBase(branch: string): BranchState["conflict"] {
  const baseBranch = getPrBaseBranch(branch);
  if (baseBranch === undefined) return undefined;
  const status = checkConflictsWithBase(baseBranch);
  return status.hasConflicts ? { baseBranch, files: status.conflictFiles } : undefined;
}

function collectState(branch: string): BranchState {
  const upstream = getRemoteTrackingBranch(branch);
  return {
    branch,
    upstream,
    ...aheadBehind(branch, upstream),
    conflict: conflictWithBase(branch),
  };
}

/**
 * 状態を調べる対象のブランチを決める。調べない場合は理由をログに残す。
 *
 * @param stopHookActive - このターンで既に Stop hook から継続しているか
 * @returns 対象のブランチ。調べない場合は undefined
 */
function branchToCheck(stopHookActive: boolean): string | undefined {
  if (stopHookActive) {
    logger.debug("Skipping: already continued once this turn");
    return undefined;
  }
  if (!isGitRepo()) {
    logger.debug("Skipping: not a git repository");
    return undefined;
  }
  const branch = getCurrentBranch();
  if (branch === undefined) logger.debug("Skipping: detached HEAD");
  return branch;
}

/**
 * ブランチ状態を調べ、前回通知したときから変わっていれば通知する行を返す。
 *
 * @param branch - 対象のブランチ
 * @param sessionId - 前回の状態を記録するセッション
 * @returns 通知する行。変化が無ければ空
 */
function changedStateLines(branch: string, sessionId: string): string[] {
  const state = collectState(branch);
  const key = stateKey(state);
  const path = stateFilePath(sessionId);
  const changed = readLastKey(path) !== key;
  writeFileSync(path, key);
  logger.debug(`Branch state ${changed ? "changed" : "unchanged"}: ${key}`);
  return changed ? formatBranchState(state) : [];
}

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  // hooks.json で async: true にしているので、Claude の停止を待たせない。
  // async hook の systemMessage はユーザーには表示されず、次のターンで Claude に渡る
  run: wrapRun(logger, (context) => {
    const branch = branchToCheck(context.input.stop_hook_active);
    if (branch === undefined) return context.success({});

    const lines = changedStateLines(branch, context.input.session_id);
    if (lines.length === 0) return context.success({});
    return context.json({
      event: "Stop",
      output: { systemMessage: lines.join("\n") },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

export { parseMergeTreeOutput, parseRevListCount };
