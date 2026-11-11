/**
 * Issue の関係（親子・依存・tracked）を読み取って表示するための共通処理。
 */

import { graphql, issueNodeId, need } from "./gh-client.js";

/** GraphQL で取得した Issue の最小限の情報 */
export type IssueNode = { number: number; title: string; state: string };

/**
 * `<owner/repo> <issue-number>` 引数の Issue について、指定したフィールドを GraphQL で取得する。
 * @param args CLI 引数
 * @param fields `... on Issue` の中に書くフィールド
 * @returns Issue ノード
 */
export const queryIssue = async (args: string[], fields: string) => {
  const repo = need(args[0], "owner/repo");
  const num = need(args[1], "issue-number");
  const id = await issueNodeId(repo, Number(num));
  const data = await graphql(
    `
      query ($id: ID!) {
        node(id: $id) {
          ... on Issue {
            ${fields}
          }
        }
      }
    `,
    { id },
  );
  return data.node;
};

/**
 * 完了状態のチェックボックス付きの行にする。
 * @param node Issue
 * @param indent 行頭の字下げ
 * @returns 表示する行
 */
export const checklistLine = (node: IssueNode, indent: string): string =>
  `${indent}${node.state === "CLOSED" ? "[x]" : "[ ]"} #${node.number} ${node.title}`;

/**
 * 状態を括弧書きした行にする。
 * @param node Issue
 * @returns 表示する行
 */
export const stateLine = (node: IssueNode): string =>
  `  - #${node.number} ${node.title} (${node.state})`;

/**
 * 見出しと行を表示する。行が無ければ見出しも出さない。
 * @param header 見出し
 * @param lines 見出しの下に出す行
 */
export const printSection = (header: string, lines: string[]): void => {
  if (lines.length === 0) return;
  console.log(header);
  for (const line of lines) console.log(line);
};

/**
 * 親 Issue があれば表示する。
 * @param parent 親 Issue（無ければ null）
 * @param prefix 行頭に付ける文字列
 */
export const printParent = (parent: IssueNode | null, prefix: string): void => {
  if (parent) console.log(`${prefix}Parent: #${parent.number} (${parent.title})`);
};

/** 親と sub-issue を取得するフィールド */
export const SUB_ISSUE_FIELDS = `
  number
  title
  parent {
    number
    title
  }
  subIssues(first: 50) {
    nodes {
      number
      title
      state
    }
  }
  subIssuesSummary {
    total
    completed
    percentCompleted
  }
`;

/**
 * 関係する Issue の一覧を取得するフィールド
 * @param name GraphQL のフィールド名
 * @param first 取得する件数
 * @returns GraphQL のフィールド定義
 */
export const relatedIssuesField = (name: string, first: number): string => `
  ${name}(first: ${first}) {
    nodes {
      number
      title
      state
    }
  }
`;
