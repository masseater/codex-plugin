#!/usr/bin/env bun
/**
 * PRのCIジョブログをダウンロード
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
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

const main = defineCommand({
  meta: {
    name: "get-ci-logs",
    description: "CI jobのログをダウンロード",
  },
  args: {
    "output-dir": {
      type: "string",
      description: "ログ保存先ディレクトリ（デフォルト: .agents/ci-logs/pr-{number}）",
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
    });

    const completedRuns = checkRuns.check_runs.filter((run) => run.status === "completed");

    const filteredByConclusion = args.all
      ? completedRuns
      : completedRuns.filter(
          (run) => run.conclusion === "failure" || run.conclusion === "timed_out",
        );

    const nameFilter = args.name;
    const filteredRuns = nameFilter
      ? filteredByConclusion.filter((run) => run.name.includes(nameFilter))
      : filteredByConclusion;

    const outputDir = args["output-dir"] ?? join(".agents", "ci-logs", `pr-${pr}`);
    await mkdir(outputDir, { recursive: true });

    const downloaded: DownloadedLog[] = [];
    const skipped: SkippedLog[] = [];

    for (const run of filteredRuns) {
      const jobId = parseJobId(run.details_url);
      if (!jobId) {
        skipped.push({
          name: run.name,
          reason: "Not a GitHub Actions check",
        });
        continue;
      }

      try {
        const response = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
          owner,
          repo,
          job_id: jobId,
        });

        const logContent =
          typeof response.data === "string" ? response.data : String(response.data);
        const fileName = `${sanitizeName(run.name)}.log`;
        const filePath = join(outputDir, fileName);

        await writeFile(filePath, logContent, "utf-8");

        downloaded.push({
          name: run.name,
          conclusion: run.conclusion ?? "unknown",
          path: filePath,
        });
      } catch (error) {
        skipped.push({
          name: run.name,
          reason: error instanceof Error ? error.message : "Unknown download error",
        });
      }
    }

    const result: CILogsResult = { pr, outputDir, downloaded, skipped };
    console.log(JSON.stringify(result, null, 2));
  },
});

runMain(main);
