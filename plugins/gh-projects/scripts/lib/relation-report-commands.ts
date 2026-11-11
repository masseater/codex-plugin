/**
 * Issue の依存関係・tracked issue を読み取り専用で表示するコマンド群。
 */

import type { Command } from "./gh-client.js";
import {
  checklistLine,
  type IssueNode,
  printParent,
  printSection,
  queryIssue,
  relatedIssuesField,
  stateLine,
  SUB_ISSUE_FIELDS,
} from "./issue-report.js";

type DependenciesSummary = {
  blockedBy: number;
  blocking: number;
  totalBlockedBy: number;
  totalBlocking: number;
};

/**
 * 依存関係の件数を表示する。依存が 1 件も無ければ何も出さない。
 * @param dep issueDependenciesSummary
 */
const printDependencySummary = (dep: DependenciesSummary): void => {
  if (dep.totalBlockedBy === 0 && dep.totalBlocking === 0) return;
  console.log(
    `\nDependency summary: blocked by ${dep.blockedBy} open (${dep.totalBlockedBy} total), blocking ${dep.blocking} open (${dep.totalBlocking} total)`,
  );
};

export const relationReportCommands: Record<string, Command> = {
  // --- Dependency summary (GraphQL) ---
  "deps:show": {
    description: "Show all dependency relationships for an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const issue = await queryIssue(
        args,
        `
          ${SUB_ISSUE_FIELDS}
          ${relatedIssuesField("blockedBy", 20)}
          ${relatedIssuesField("blocking", 20)}
          ${relatedIssuesField("trackedInIssues", 20)}
          ${relatedIssuesField("trackedIssues", 20)}
          issueDependenciesSummary {
            blockedBy
            blocking
            totalBlockedBy
            totalBlocking
          }
        `,
      );
      console.log(`\n#${issue.number} ${issue.title}`);
      console.log("=".repeat(50));

      printParent(issue.parent, "\n");
      const s = issue.subIssuesSummary;
      printSection(
        `\nSub-issues (${s.completed}/${s.total}):`,
        issue.subIssues.nodes.map((sub: IssueNode) => checklistLine(sub, "  ")),
      );
      printSection(`\nBlocked by:`, issue.blockedBy.nodes.map(stateLine));
      printSection(`\nBlocking:`, issue.blocking.nodes.map(stateLine));
      printSection(`\nTracked in:`, issue.trackedInIssues.nodes.map(stateLine));
      printSection(`\nTracking:`, issue.trackedIssues.nodes.map(stateLine));
      printDependencySummary(issue.issueDependenciesSummary);
    },
  },

  // --- Tracked Issues (read-only via GraphQL) ---
  "tracked:list": {
    description: "List tracked issues and tracking issues for an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const issue = await queryIssue(
        args,
        `
          number
          title
          ${relatedIssuesField("trackedIssues", 50)}
          trackedIssuesCount
          ${relatedIssuesField("trackedInIssues", 50)}
        `,
      );
      console.log(`#${issue.number} ${issue.title}`);
      printSection(
        `\nTracking (${issue.trackedIssuesCount}):`,
        issue.trackedIssues.nodes.map((t: IssueNode) => checklistLine(t, "  ")),
      );
      printSection(`\nTracked in:`, issue.trackedInIssues.nodes.map(stateLine));
    },
  },
};
