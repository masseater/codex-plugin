#!/usr/bin/env bun
/**
 * 現在のブランチに紐づくPRのCI状態を取得
 */

import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { env } from "../env.js";
import { getCurrentPRInfo } from "../lib/pr-info.js";

type CheckRun = {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
};

type CIStatusResult = {
  owner: string;
  repo: string;
  pr: number;
  headSha: string;
  overallStatus: "success" | "failure" | "pending" | "neutral";
  checks: CheckRun[];
};

async function fetchCIStatus(
  owner: string,
  repo: string,
  headSha: string,
  pr: number,
): Promise<CIStatusResult> {
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  const { data: checkRuns } = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: headSha,
  });

  const checks: CheckRun[] = checkRuns.check_runs.map((run) => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    detailsUrl: run.details_url,
  }));

  let overallStatus: CIStatusResult["overallStatus"] = "success";

  for (const check of checks) {
    if (check.status !== "completed") {
      overallStatus = "pending";
      break;
    }
    if (check.conclusion === "failure" || check.conclusion === "timed_out") {
      overallStatus = "failure";
      break;
    }
    if (check.conclusion === "neutral" || check.conclusion === "skipped") {
      if (overallStatus === "success") {
        overallStatus = "neutral";
      }
    }
  }

  return { owner, repo, pr, headSha, overallStatus, checks };
}

const main = defineCommand({
  meta: {
    name: "get-ci-status",
    description: "PRのCI状態を取得",
  },
  args: {
    name: {
      type: "string",
      description: "チェック名でフィルタ（部分一致）",
      required: false,
    },
  },
  async run({ args }) {
    const { owner, repo, pr, headSha } = await getCurrentPRInfo();
    const result = await fetchCIStatus(owner, repo, headSha, pr);

    if (args.name) {
      const nameFilter = args.name;
      const filtered = {
        ...result,
        checks: result.checks.filter((c) => c.name.includes(nameFilter)),
      };
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    console.log(JSON.stringify(result, null, 2));
  },
});

runMain(main);
