/**
 * Issue の親子階層 (sub-issue) を操作するコマンド群。
 */

import { graphql, issueNodeId, need, type Command } from "./gh-client.js";
import { checklistLine, printParent, queryIssue, SUB_ISSUE_FIELDS } from "./issue-report.js";

type IssueSummary = { number: number; title: string };

/**
 * 親子関係を変更する mutation のコマンドを作る。
 * @param mutation addSubIssue か removeSubIssue
 * @param description コマンドの説明
 * @param report 変更後に表示する文面
 * @returns コマンド
 */
const subIssueMutationCommand = (
  mutation: "addSubIssue" | "removeSubIssue",
  description: string,
  report: (issue: IssueSummary, subIssue: IssueSummary) => string,
): Command => ({
  description,
  usage: "<owner/repo> <parent-number> <child-number>",
  run: async (args) => {
    const repo = need(args[0], "owner/repo");
    const parentNum = need(args[1], "parent-number");
    const childNum = need(args[2], "child-number");
    const parentId = await issueNodeId(repo, Number(parentNum));
    const childId = await issueNodeId(repo, Number(childNum));
    const data = await graphql(
      `
        mutation ($parentId: ID!, $childId: ID!) {
          ${mutation}(input: { issueId: $parentId, subIssueId: $childId }) {
            issue {
              number
              title
            }
            subIssue {
              number
              title
            }
          }
        }
      `,
      { parentId, childId },
    );
    const { issue, subIssue } = data[mutation];
    console.log(report(issue, subIssue));
  },
});

export const subIssueCommands: Record<string, Command> = {
  "sub-issue:add": subIssueMutationCommand(
    "addSubIssue",
    "Add a sub-issue to a parent issue",
    (issue, subIssue) =>
      `Added #${subIssue.number} (${subIssue.title}) as sub-issue of #${issue.number} (${issue.title})`,
  ),

  "sub-issue:remove": subIssueMutationCommand(
    "removeSubIssue",
    "Remove a sub-issue from a parent issue",
    (issue, subIssue) => `Removed #${subIssue.number} from parent #${issue.number}`,
  ),

  "sub-issue:list": {
    description: "List sub-issues of an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const issue = await queryIssue(args, SUB_ISSUE_FIELDS);
      console.log(`#${issue.number} ${issue.title}`);
      printParent(issue.parent, "  ");
      if (issue.subIssues.nodes.length === 0) {
        console.log("  No sub-issues");
        return;
      }
      const s = issue.subIssuesSummary;
      console.log(`  Sub-issues: ${s.completed}/${s.total} completed (${s.percentCompleted}%)`);
      for (const sub of issue.subIssues.nodes) {
        console.log(checklistLine(sub, "    "));
      }
    },
  },
};
