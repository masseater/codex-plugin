#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { Octokit } from "@octokit/rest";
import type { Endpoints } from "@octokit/types";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { FAILURE_CONCLUSIONS } from "../../lib/ci-status.ts";
import {
  type PrConflictStatus,
  formatConflictMessage,
  getCurrentBranch,
  getHeadSha,
  getPrConflictStatus,
  isGitPushCommand,
} from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * CI を待つ上限。hooks.json で async 実行するので Claude Code は timeout を強制しない。
 * 終わらない run を待ち続けてバックグラウンドプロセスが残らないよう、ここで打ち切る
 */
const CI_WATCH_TIMEOUT_MS = 10 * 60 * 1000;
const RUN_APPEAR_POLL_INTERVAL_MS = 3000;
const RUN_APPEAR_MAX_RETRIES = 10;
const RUN_STATUS_POLL_INTERVAL_MS = 10_000;

export type WorkflowRun =
  Endpoints["GET /repos/{owner}/{repo}/actions/runs"]["response"]["data"]["workflow_runs"][number];

export type RunSummary = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  failedJobs: string[];
};

export type CIWatchResult = {
  headSha: string;
  runs: RunSummary[];
  timedOut: boolean;
};

export type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Bash: true,
    },
  },
  // hooks.json で async: true にしているので、CI の完了を待ってから結果を 1 回だけ返す。
  // async hook の出力は次のターンで Claude に渡る
  run: wrapRun(logger, async (context) => {
    if (!isGitPushCommand(context.input.tool_input.command)) {
      return context.success({});
    }

    const branch = getCurrentBranch();
    const headSha = getHeadSha();
    if (!branch || !headSha) {
      logger.debug("Skipping: current branch or HEAD is unavailable");
      return context.success({});
    }

    const additionalContext = await pushReport(branch, headSha);
    logger.info(additionalContext);
    return context.json({
      event: "PostToolUse",
      output: {
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext },
      },
    });
  }),
});

/**
 * push 後の状態を報告する文面を作る。conflict 中は pull_request の CI が起動しないので、CI を待たずに conflict を伝える。
 *
 * @param branch - push したブランチ
 * @param headSha - push した HEAD
 * @returns Claude に渡す文面
 */
async function pushReport(branch: string, headSha: string): Promise<string> {
  const conflict = getPrConflictStatus(branch);
  if (conflict?.hasConflicts) {
    return formatConflictMessage(branch, conflict.baseBranch, conflict.conflictFiles);
  }

  logger.info(`Git push detected on ${branch} at ${headSha}`);
  const result = await watchCI(branch, headSha);
  return formatCIResult(branch, result, getPrConflictStatus(branch));
}

export function getRepoInfo(remoteUrl: string): { owner: string; repo: string } | null {
  const match = remoteUrl.trim().match(/[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

function readRemoteUrl(): string | null {
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" });
  } catch (error) {
    // origin がないリポジトリでは CI を監視できないだけなので、監視を諦めて結果なしで返す
    logger.debug(`git remote get-url failed: ${String(error)}`);
    return null;
  }
}

function getGithubToken(): string | null {
  const fromEnv = process.env["GITHUB_TOKEN"]?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim() || null;
  } catch (error) {
    // gh 未ログインの環境では CI を監視できない。呼び出し側で warn を出して監視を諦める
    logger.debug(`gh auth token failed: ${String(error)}`);
    return null;
  }
}

async function listRunsForSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  headSha: string,
): Promise<WorkflowRun[]> {
  const res = await octokit.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    branch,
    head_sha: headSha,
    per_page: 100,
  });
  return res.data.workflow_runs;
}

// push 直後は run が作られるまで少し時間がかかるので、見つかるまで取り直す
export async function waitForRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  headSha: string,
  sleep: Sleep = defaultSleep,
): Promise<WorkflowRun[]> {
  for (let i = 0; i < RUN_APPEAR_MAX_RETRIES; i++) {
    try {
      const runs = await listRunsForSha(octokit, owner, repo, branch, headSha);
      if (runs.length > 0) return runs;
    } catch (error) {
      // 一時的な API エラーは次の試行で回復しうるので、上限回数までは取り直す
      logger.debug(`Failed to list runs: ${String(error)}`);
    }
    await sleep(RUN_APPEAR_POLL_INTERVAL_MS);
  }
  return [];
}

async function failedJobNames(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
): Promise<string[]> {
  try {
    const res = await octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      per_page: 100,
    });
    return res.data.jobs
      .filter((job) => FAILURE_CONCLUSIONS.has(job.conclusion ?? ""))
      .map((job) => job.name);
  } catch (error) {
    // job 名は補足情報なので、取れなければ run 単位の結果だけを返す
    logger.warn(`Failed to list jobs for run ${runId}: ${String(error)}`);
    return [];
  }
}

type GitHubTarget = { owner: string; repo: string; token: string };

/**
 * CI を監視する GitHub リポジトリと、API のトークンを決める。
 *
 * @returns 監視先とトークン。origin が GitHub でないかトークンが無ければ null
 */
function githubTarget(): GitHubTarget | null {
  const remoteUrl = readRemoteUrl();
  const repoInfo = remoteUrl ? getRepoInfo(remoteUrl) : null;
  const token = getGithubToken();
  return repoInfo && token ? { ...repoInfo, token } : null;
}

type RunQuery = {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  headSha: string;
};

/**
 * run の一覧を取り直す。失敗したら前回の状態のまま返す。
 *
 * @param query - 対象の run を探す条件
 * @param previous - 前回取得した run
 * @returns 最新の run。取り直せなければ previous
 */
async function refreshRuns(query: RunQuery, previous: WorkflowRun[]): Promise<WorkflowRun[]> {
  try {
    return await listRunsForSha(
      query.octokit,
      query.owner,
      query.repo,
      query.branch,
      query.headSha,
    );
  } catch (error) {
    // 取り直しに失敗したら前回の状態のまま次の周回で再試行する
    logger.debug(`Failed to poll runs: ${String(error)}`);
    return previous;
  }
}

/**
 * すべての run が完了するか期限に達するまで、一定間隔で run を取り直す。
 *
 * @param query - 対象の run を探す条件
 * @param runs - 最初に見つかった run
 * @param sleep - 待機関数
 * @param deadline - 監視を打ち切る時刻（エポックミリ秒）
 * @returns 最後に取得した run
 */
async function pollUntilCompleted(
  query: RunQuery,
  runs: WorkflowRun[],
  sleep: Sleep,
  deadline: number,
): Promise<WorkflowRun[]> {
  let current = runs;
  while (current.some((run) => run.status !== "completed") && Date.now() < deadline) {
    await sleep(RUN_STATUS_POLL_INTERVAL_MS);
    current = await refreshRuns(query, current);
  }
  return current;
}

/**
 * GitHub の run ID は int64 として型付けされるが、Number.MAX_SAFE_INTEGER には届かないので number で扱う
 * @param run - 対象の workflow run
 * @returns number にした run ID
 */
function runIdOf(run: WorkflowRun): number {
  return Number(run.id);
}

async function runFailedJobs(query: RunQuery, run: WorkflowRun): Promise<string[]> {
  return FAILURE_CONCLUSIONS.has(run.conclusion ?? "")
    ? failedJobNames(query.octokit, query.owner, query.repo, runIdOf(run))
    : [];
}

async function summarizeRun(query: RunQuery, run: WorkflowRun): Promise<RunSummary> {
  return {
    id: runIdOf(run),
    name: run.name ?? `run ${run.id}`,
    status: run.status ?? "unknown",
    conclusion: run.conclusion,
    failedJobs: await runFailedJobs(query, run),
  };
}

export async function watchCI(
  branch: string,
  headSha: string,
  sleep: Sleep = defaultSleep,
): Promise<CIWatchResult> {
  const empty: CIWatchResult = { headSha, runs: [], timedOut: false };
  const target = githubTarget();
  if (!target) {
    logger.warn(
      "CI watch skipped: no GitHub remote or token (set GITHUB_TOKEN or `gh auth login`)",
    );
    return empty;
  }
  const query: RunQuery = {
    octokit: new Octokit({ auth: target.token }),
    owner: target.owner,
    repo: target.repo,
    branch,
    headSha,
  };
  const deadline = Date.now() + CI_WATCH_TIMEOUT_MS;

  const initialRuns = await waitForRuns(
    query.octokit,
    query.owner,
    query.repo,
    branch,
    headSha,
    sleep,
  );
  if (initialRuns.length === 0) return empty;

  const runs = await pollUntilCompleted(query, initialRuns, sleep, deadline);
  const summaries = await Promise.all(runs.map((run) => summarizeRun(query, run)));

  return {
    headSha,
    runs: summaries,
    timedOut: summaries.some((run) => run.status !== "completed"),
  };
}

function completedLabel(conclusion: string): string {
  if (conclusion === "success") return "pass";
  return FAILURE_CONCLUSIONS.has(conclusion) ? "FAIL" : conclusion;
}

function runLabel(run: RunSummary): string {
  if (run.status !== "completed") return run.status;
  return completedLabel(run.conclusion ?? "unknown");
}

function runLine(run: RunSummary): string {
  const jobs = run.failedJobs.length > 0 ? `: ${run.failedJobs.join(", ")}` : "";
  return `- [${runLabel(run)}] ${run.name} (run ${run.id})${jobs}`;
}

function conflictLines(branch: string, conflictStatus: PrConflictStatus | undefined): string[] {
  return conflictStatus?.hasConflicts
    ? [formatConflictMessage(branch, conflictStatus.baseBranch, conflictStatus.conflictFiles)]
    : [];
}

/**
 * 結果の末尾に付ける注意書き（未完了・失敗時の手順）を作る。
 *
 * @param result - CI の監視結果
 * @param failedCount - 失敗した run の数
 * @returns 注意書きの行
 */
function noticeLines(result: CIWatchResult, failedCount: number): string[] {
  return [
    ...(result.timedOut ? ["[CI] 監視の上限（10 分）に達した時点で未完了の run がある"] : []),
    ...(failedCount > 0 ? ["[CI] 失敗した run のフルログ取得手順: github-workflow:debug-gha"] : []),
  ];
}

export function formatCIResult(
  branch: string,
  result: CIWatchResult,
  conflictStatus?: PrConflictStatus,
): string {
  const head = `[CI] ${branch} (${result.headSha.slice(0, 7)})`;
  if (result.runs.length === 0) {
    return `${head}: push 後に workflow run が見つからない`;
  }

  const failed = result.runs.filter((run) => runLabel(run) === "FAIL");
  const passed = result.runs.filter((run) => runLabel(run) === "pass");
  return [
    `${head}: 失敗 ${failed.length} / 成功 ${passed.length} / その他 ${result.runs.length - failed.length - passed.length}`,
    ...result.runs.map(runLine),
    ...noticeLines(result, failed.length),
    ...conflictLines(branch, conflictStatus),
  ].join("\n");
}

if (import.meta.main) {
  await runHook(hook);
}
