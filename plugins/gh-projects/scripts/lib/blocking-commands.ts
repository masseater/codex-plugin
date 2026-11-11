/**
 * Issue 間の blocked-by 依存関係を追加・削除するコマンド群。
 */

import { graphql, issueNodeId, need, type Command } from "./gh-client.js";

/**
 * blocked-by 関係を変更する mutation のコマンドを作る。
 * @param mutation addBlockedBy か removeBlockedBy
 * @param description コマンドの説明
 * @param report 変更後に表示する文面
 * @returns コマンド
 */
const blockedByCommand = (
  mutation: "addBlockedBy" | "removeBlockedBy",
  description: string,
  report: (blockedNum: string, blockingNum: string) => string,
): Command => ({
  description,
  usage: "<owner/repo> <blocked-number> <blocking-number>",
  run: async (args) => {
    const repo = need(args[0], "owner/repo");
    const blockedNum = need(args[1], "blocked-number");
    const blockingNum = need(args[2], "blocking-number");
    const blockedId = await issueNodeId(repo, Number(blockedNum));
    const blockingId = await issueNodeId(repo, Number(blockingNum));
    await graphql(
      `
        mutation ($issueId: ID!, $blockingIssueId: ID!) {
          ${mutation}(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
            issue {
              number
              title
            }
            blockingIssue {
              number
              title
            }
          }
        }
      `,
      { issueId: blockedId, blockingIssueId: blockingId },
    );
    console.log(report(blockedNum, blockingNum));
  },
});

export const blockingCommands: Record<string, Command> = {
  "block:add": blockedByCommand(
    "addBlockedBy",
    "Set issue A is blocked by issue B",
    (blockedNum, blockingNum) => `#${blockedNum} is now blocked by #${blockingNum}`,
  ),

  "block:remove": blockedByCommand(
    "removeBlockedBy",
    "Remove a blocked-by relationship",
    (blockedNum, blockingNum) => `Removed: #${blockedNum} is no longer blocked by #${blockingNum}`,
  ),
};
