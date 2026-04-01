#!/usr/bin/env bun
/**
 * 現在のブランチに紐づくPRの未解決スレッドIDを取得
 */

import { defineCommand, runMain } from "citty";
import { Octokit } from "octokit";
import { env } from "../env.js";
import { getCurrentPRInfo } from "../lib/pr-info.js";

type UnresolvedThreadsResult = {
  owner: string;
  repo: string;
  pr: number;
  threadIds: string[];
};

const QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            isOutdated
          }
        }
      }
    }
  }
`;

async function fetchUnresolvedThreads(
  owner: string,
  repo: string,
  pr: number,
): Promise<UnresolvedThreadsResult> {
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  const result = await octokit.graphql<{
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: Array<{
            id: string;
            isResolved: boolean;
            isOutdated: boolean;
          }>;
        };
      };
    };
  }>(QUERY, { owner, repo, pr });

  const threadIds = result.repository.pullRequest.reviewThreads.nodes
    .filter((thread) => !thread.isResolved && !thread.isOutdated)
    .map((thread) => thread.id);

  return { owner, repo, pr, threadIds };
}

const main = defineCommand({
  meta: {
    name: "get-unresolved-threads",
    description: "未解決スレッドID一覧を取得",
  },
  async run() {
    const { owner, repo, pr } = await getCurrentPRInfo();
    const result = await fetchUnresolvedThreads(owner, repo, pr);
    console.log(JSON.stringify(result, null, 2));
  },
});

runMain(main);
