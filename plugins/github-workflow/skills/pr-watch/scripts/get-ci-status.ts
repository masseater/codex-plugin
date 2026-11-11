#!/usr/bin/env bun
/**
 * 現在のブランチに紐づくPRのCI状態を取得
 */

import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { type OverallStatus, computeOverallStatus } from "../../../lib/ci-status.ts";
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
  overallStatus: OverallStatus;
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
    // 既定の 30 件では大きな matrix の check を取りこぼす
    per_page: 100,
  });

  const checks: CheckRun[] = checkRuns.check_runs.map((run) => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    detailsUrl: run.details_url,
  }));

  const overallStatus = computeOverallStatus(checks);

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

await runMain(main);
