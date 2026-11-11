/**
 * GitHub Projects (v2) 本体・Item・Field を操作するコマンド群。
 */

import { $, gh, graphql, need, type Command } from "./gh-client.js";

type ProjectField = {
  id: string;
  name: string;
  options: { id: string; name: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * gh の JSON 出力から、指定キーの配列に含まれるオブジェクトだけを取り出す。
 * @param value gh の JSON 出力
 * @param key 配列を持つキー（fields / items）
 * @returns オブジェクトの配列。キーが無ければ空配列
 */
function recordsOf(value: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  const list = value[key];
  return Array.isArray(list) ? list.filter((entry) => isRecord(entry)) : [];
}

/**
 * gh project field-list の 1 要素を ProjectField に変換する。形が違えば空配列。
 * @param field field-list の fields の要素
 * @returns 変換したフィールド（0 または 1 要素）
 */
function toProjectField(field: Record<string, unknown>): ProjectField[] {
  if (typeof field.id !== "string" || typeof field.name !== "string") return [];
  const options = Array.isArray(field.options)
    ? field.options.flatMap((option) =>
        isRecord(option) && typeof option.id === "string" && typeof option.name === "string"
          ? [{ id: option.id, name: option.name }]
          : [],
      )
    : [];
  return [{ id: field.id, name: field.name, options }];
}

/**
 * organization か user のログイン名から、GraphQL のノード ID を引く。
 * @param owner ログイン名
 * @returns ノード ID
 */
async function ownerNodeId(owner: string): Promise<string> {
  const ownerData = await graphql(
    `
      query ($login: String!) {
        organization(login: $login) {
          id
        }
      }
    `,
    { login: owner },
  ).catch((error: unknown) => {
    // organization として見つからない owner は user として引き直す。どちらでも無ければ下で Owner not found にする
    console.error(`organization lookup failed, retrying as user: ${String(error)}`);
    return graphql(
      `
        query ($login: String!) {
          user(login: $login) {
            id
          }
        }
      `,
      { login: owner },
    );
  });
  const ownerId = ownerIdOf(ownerData);
  if (!ownerId) throw new Error(`Owner not found: ${owner}`);
  return ownerId;
}

function ownerIdOf(ownerData: {
  organization?: { id?: string };
  user?: { id?: string };
}): string | undefined {
  return ownerData.organization?.id ?? ownerData.user?.id;
}

/**
 * リポジトリの GraphQL ノード ID を引く。
 * @param owner リポジトリの owner
 * @param repo リポジトリ名
 * @returns ノード ID
 */
async function repositoryNodeId(owner: string, repo: string): Promise<string> {
  const repoData = await graphql(
    `
      query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
        }
      }
    `,
    { owner, name: repo },
  );
  const repositoryId = repoData.repository?.id;
  if (!repositoryId) throw new Error(`Repository not found: ${owner}/${repo}`);
  return repositoryId;
}

/**
 * リポジトリに紐づく project を作る（gh project create はリポジトリを指定できないため GraphQL を使う）。
 * @param ownerOrRepo `owner/repo` 形式のリポジトリ指定
 * @param title project のタイトル
 */
async function createRepositoryProject(ownerOrRepo: string, title: string): Promise<void> {
  const [ownerPart, repoPart] = ownerOrRepo.split("/");
  const owner = need(ownerPart, "owner");
  const repo = need(repoPart, "repo");
  const ownerId = await ownerNodeId(owner);
  const repositoryId = await repositoryNodeId(owner, repo);

  const data = await graphql(
    `
      mutation ($ownerId: ID!, $title: String!, $repositoryId: ID!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title, repositoryId: $repositoryId }) {
          projectV2 {
            number
            title
            url
          }
        }
      }
    `,
    { ownerId, title, repositoryId },
  );
  const project = data.createProjectV2.projectV2;
  console.log(`Created project #${project.number} "${project.title}"`);
  console.log(project.url);
}

function projectIdOf(project: unknown): string {
  if (isRecord(project) && typeof project.id === "string") return project.id;
  throw new Error("gh project view returned no project id");
}

/**
 * project の Status フィールドから、指定した値の選択肢を探す。
 * @param fieldList gh project field-list の JSON 出力
 * @param statusValue 設定する Status の値
 * @returns Status フィールドと選択肢
 */
function statusOption(
  fieldList: unknown,
  statusValue: string,
): { field: ProjectField; option: { id: string; name: string } } {
  const field = recordsOf(fieldList, "fields")
    .flatMap(toProjectField)
    .find((f) => f.name === "Status");
  if (!field) throw new Error('Project has no "Status" field');
  const option = field.options.find((o) => o.name === statusValue);
  if (!option) {
    const names = field.options.map((o) => o.name).join(", ") || "(none)";
    throw new Error(`No Status option "${statusValue}". Available: ${names}`);
  }
  return { field, option };
}

function isItemFor(item: Record<string, unknown>, issueUrl: string): boolean {
  return isRecord(item.content) && item.content.url === issueUrl;
}

/**
 * project の item から、Issue の URL に対応する item ID を探す。
 * @param itemList gh project item-list の JSON 出力
 * @param issueUrl Issue の URL
 * @returns item ID
 */
function itemIdFor(itemList: unknown, issueUrl: string): string {
  const itemId = recordsOf(itemList, "items").find((i) => isItemFor(i, issueUrl))?.id;
  if (typeof itemId !== "string") throw new Error(`Issue not found in project: ${issueUrl}`);
  return itemId;
}

export const projectCommands: Record<string, Command> = {
  // --- Project CRUD ---
  "project:list": {
    description: "List projects for an owner",
    usage: "<owner>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      console.log(await gh(["project", "list", "--owner", owner]));
    },
  },

  "project:create": {
    description: "Create a new project (owner or owner/repo)",
    usage: "<owner-or-owner/repo> <title>",
    run: async (args) => {
      const ownerOrRepo = need(args[0], "owner-or-owner/repo");
      const title = need(args[1], "title");
      if (ownerOrRepo.includes("/")) {
        await createRepositoryProject(ownerOrRepo, title);
        return;
      }
      console.log(await gh(["project", "create", "--owner", ownerOrRepo, "--title", title]));
    },
  },

  "project:view": {
    description: "View a project in browser",
    usage: "<owner> <number>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      const number = need(args[1], "number");
      console.log(await gh(["project", "view", number, "--owner", owner, "--web"]));
    },
  },

  // --- Item operations ---
  "item:list": {
    description: "List items in a project",
    usage: "<owner> <project-number>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      const number = need(args[1], "project-number");
      console.log(await gh(["project", "item-list", number, "--owner", owner]));
    },
  },

  "item:add": {
    description: "Add an issue/PR to a project",
    usage: "<owner> <project-number> <issue-or-pr-url>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      const number = need(args[1], "project-number");
      const url = need(args[2], "issue-or-pr-url");
      console.log(await gh(["project", "item-add", number, "--owner", owner, "--url", url]));
    },
  },

  // --- Field operations ---
  "field:list": {
    description: "List fields in a project",
    usage: "<owner> <project-number>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      const number = need(args[1], "project-number");
      console.log(await gh(["project", "field-list", number, "--owner", owner]));
    },
  },

  "status:set": {
    description: "Set an issue's Status (single-select) field in a project",
    usage: "<owner> <project-number> <issue-url> <status-value>",
    run: async (args) => {
      const owner = need(args[0], "owner");
      const projectNumber = need(args[1], "project-number");
      const issueUrl = need(args[2], "issue-url");
      const statusValue = need(args[3], "status-value");

      const projectId = projectIdOf(
        await $`gh project view ${projectNumber} --owner ${owner} --format json`.json(),
      );
      const { field: statusField, option } = statusOption(
        await $`gh project field-list ${projectNumber} --owner ${owner} --format json`.json(),
        statusValue,
      );
      const itemId = itemIdFor(
        await $`gh project item-list ${projectNumber} --owner ${owner} --format json --limit 200`.json(),
        issueUrl,
      );

      await $`gh project item-edit --id ${itemId} --project-id ${projectId} --field-id ${statusField.id} --single-select-option-id ${option.id}`;
      console.log(`Set Status="${statusValue}" for ${issueUrl}`);
    },
  },
};
