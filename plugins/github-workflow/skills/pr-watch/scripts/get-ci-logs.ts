#!/usr/bin/env bun
/**
 * PRのCIジョブログをダウンロード
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { isFailedCheck } from "../../../lib/ci-status.ts";
import { env } from "../env.js";
import { getCurrentPRInfo } from "../lib/pr-info.js";

type DownloadedLog = {
  name: string;
  conclusion: string;
  path: string;
};

type SkippedLog = {
  name: string;
  reason: string;
};

type CILogsResult = {
  pr: number;
  outputDir: string;
  downloaded: DownloadedLog[];
  skipped: SkippedLog[];
};

function parseJobId(detailsUrl: string | null): number | null {
  if (!detailsUrl) return null;
  const match = detailsUrl.match(/\/actions\/runs\/\d+\/job\/(\d+)/);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
}

type CheckRun = Awaited<
  ReturnType<Octokit["rest"]["checks"]["listForRef"]>
>["data"]["check_runs"][number];

type LogOutcome = { downloaded: DownloadedLog } | { skipped: SkippedLog };

type LogTarget = { octokit: Octokit; owner: string; repo: string; outputDir: string };

/**
 * ログを取る check run を選ぶ。既定では失敗した run だけを対象にする。
 *
 * @param checkRuns - head commit の check run
 * @param filter - 全件を対象にするか、チェック名の部分一致
 * @returns 完了していて条件に合う check run
 */
function selectRuns(
  checkRuns: CheckRun[],
  filter: { all?: boolean | undefined; name?: string | undefined },
): CheckRun[] {
  const completed = checkRuns.filter((run) => run.status === "completed");
  const byConclusion = filter.all ? completed : completed.filter((run) => isFailedCheck(run));
  const { name } = filter;
  return name ? byConclusion.filter((run) => run.name.includes(name)) : byConclusion;
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown download error";
}

/**
 * 1 つの check run のジョブログを保存する。GitHub Actions 以外の check や取得に失敗したものは理由を付けてスキップする。
 *
 * @param target - 取得先のリポジトリと保存先
 * @param run - check run
 * @returns 保存したログか、スキップした理由
 */
async function downloadRunLog(target: LogTarget, run: CheckRun): Promise<LogOutcome> {
  const jobId = parseJobId(run.details_url);
  if (!jobId) {
    return { skipped: { name: run.name, reason: "Not a GitHub Actions check" } };
  }

  try {
    const response = await target.octokit.rest.actions.downloadJobLogsForWorkflowRun({
      owner: target.owner,
      repo: target.repo,
      job_id: jobId,
    });
    const filePath = join(target.outputDir, `${sanitizeName(run.name)}.log`);
    await writeFile(filePath, String(response.data), "utf-8");
    return {
      downloaded: { name: run.name, conclusion: run.conclusion ?? "unknown", path: filePath },
    };
  } catch (error) {
    return { skipped: { name: run.name, reason: errorReason(error) } };
  }
}

async function downloadRunLogs(target: LogTarget, runs: CheckRun[]): Promise<LogOutcome[]> {
  const outcomes: LogOutcome[] = [];
  for (const run of runs) {
    outcomes.push(await downloadRunLog(target, run));
  }
  return outcomes;
}

const main = defineCommand({
  meta: {
    name: "get-ci-logs",
    description: "CI jobのログをダウンロード",
  },
  args: {
    "output-dir": {
      type: "string",
      description: "ログ保存先ディレクトリ（デフォルト: .local-agents/tmp/ci-logs/pr-{number}）",
      required: false,
    },
    all: {
      type: "boolean",
      description: "失敗分だけでなく全ログをダウンロード",
      required: false,
    },
    name: {
      type: "string",
      description: "チェック名でフィルタ（部分一致）",
      required: false,
    },
  },
  async run({ args }) {
    const { owner, repo, pr, headSha } = await getCurrentPRInfo();
    const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

    const { data: checkRuns } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      // 既定の 30 件では大きな matrix の check を取りこぼす
      per_page: 100,
    });

    const outputDir = args["output-dir"] ?? join(".local-agents", "tmp", "ci-logs", `pr-${pr}`);
    await mkdir(outputDir, { recursive: true });

    const outcomes = await downloadRunLogs(
      { octokit, owner, repo, outputDir },
      selectRuns(checkRuns.check_runs, args),
    );
    const result: CILogsResult = {
      pr,
      outputDir,
      downloaded: outcomes.flatMap((outcome) =>
        "downloaded" in outcome ? [outcome.downloaded] : [],
      ),
      skipped: outcomes.flatMap((outcome) => ("skipped" in outcome ? [outcome.skipped] : [])),
    };
    console.log(JSON.stringify(result, null, 2));
  },
});

await runMain(main);
