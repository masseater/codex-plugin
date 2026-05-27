#!/usr/bin/env bun
/**
 * GitHub Projects CLI wrapper
 * Provides unified interface for gh project operations and GraphQL-only features.
 *
 * Usage: bun <this-file> <command> [options]
 */

const { $ } = Bun;
$.throws(true);

// --- helpers ---

const gh = async (args: string[]) => {
  const result = await $`gh ${args}`.text();
  return result.trim();
};

const graphql = async (query: string, variables: Record<string, string> = {}) => {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) {
    args.push("-f", `${k}=${v}`);
  }
  const result = await $`gh ${args}`.json();
  if (result.errors) {
    throw new Error(result.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return result.data;
};

const issueNodeId = async (repo: string, number: number) => {
  const result = await $`gh issue view ${number} -R ${repo} --json id --jq .id`.text();
  return result.trim();
};

const need = (value: string | undefined, name: string): string => {
  if (value === undefined || value === "") {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
};

// --- commands ---

type Command = {
  description: string;
  usage: string;
  run: (args: string[]) => Promise<void>;
};

const commands: Record<string, Command> = {
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
      const isRepo = ownerOrRepo.includes("/");
      if (isRepo) {
        const [ownerPart, repoPart] = ownerOrRepo.split("/");
        const owner = need(ownerPart, "owner");
        const repo = need(repoPart, "repo");
        const ownerData = await graphql(
          `
            query ($login: String!) {
              organization(login: $login) {
                id
              }
            }
          `,
          { login: owner },
        ).catch(() =>
          graphql(
            `
              query ($login: String!) {
                user(login: $login) {
                  id
                }
              }
            `,
            { login: owner },
          ),
        );
        const ownerId = ownerData.organization?.id ?? ownerData.user?.id;
        if (!ownerId) throw new Error(`Owner not found: ${owner}`);

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
        if (!repositoryId) throw new Error(`Repository not found: ${ownerOrRepo}`);

        const data = await graphql(
          `
            mutation ($ownerId: ID!, $title: String!, $repositoryId: ID!) {
              createProjectV2(
                input: { ownerId: $ownerId, title: $title, repositoryId: $repositoryId }
              ) {
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
      } else {
        console.log(await gh(["project", "create", "--owner", ownerOrRepo, "--title", title]));
      }
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

      type ProjectField = {
        id: string;
        name: string;
        options?: { id: string; name: string }[];
      };
      type ProjectItem = { id: string; content?: { url?: string } };

      const project =
        await $`gh project view ${projectNumber} --owner ${owner} --format json`.json();
      const projectId = project.id as string;

      const fieldList =
        await $`gh project field-list ${projectNumber} --owner ${owner} --format json`.json();
      const statusField = (fieldList.fields as ProjectField[]).find((f) => f.name === "Status");
      if (!statusField) throw new Error('Project has no "Status" field');
      const option = statusField.options?.find((o) => o.name === statusValue);
      if (!option) {
        const names = statusField.options?.map((o) => o.name).join(", ") ?? "(none)";
        throw new Error(`No Status option "${statusValue}". Available: ${names}`);
      }

      const itemList =
        await $`gh project item-list ${projectNumber} --owner ${owner} --format json --limit 200`.json();
      const item = (itemList.items as ProjectItem[]).find((i) => i.content?.url === issueUrl);
      if (!item) throw new Error(`Issue not found in project: ${issueUrl}`);

      await $`gh project item-edit --id ${item.id} --project-id ${projectId} --field-id ${statusField.id} --single-select-option-id ${option.id}`;
      console.log(`Set Status="${statusValue}" for ${issueUrl}`);
    },
  },

  // --- Sub-Issues (GraphQL) ---
  "sub-issue:add": {
    description: "Add a sub-issue to a parent issue",
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
            addSubIssue(input: { issueId: $parentId, subIssueId: $childId }) {
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
      const { issue, subIssue } = data.addSubIssue;
      console.log(
        `Added #${subIssue.number} (${subIssue.title}) as sub-issue of #${issue.number} (${issue.title})`,
      );
    },
  },

  "sub-issue:remove": {
    description: "Remove a sub-issue from a parent issue",
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
            removeSubIssue(input: { issueId: $parentId, subIssueId: $childId }) {
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
      const { issue, subIssue } = data.removeSubIssue;
      console.log(`Removed #${subIssue.number} from parent #${issue.number}`);
    },
  },

  "sub-issue:list": {
    description: "List sub-issues of an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const repo = need(args[0], "owner/repo");
      const num = need(args[1], "issue-number");
      const id = await issueNodeId(repo, Number(num));
      const data = await graphql(
        `
          query ($id: ID!) {
            node(id: $id) {
              ... on Issue {
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
              }
            }
          }
        `,
        { id },
      );
      const issue = data.node;
      console.log(`#${issue.number} ${issue.title}`);
      if (issue.parent) {
        console.log(`  Parent: #${issue.parent.number} (${issue.parent.title})`);
      }
      if (issue.subIssues.nodes.length > 0) {
        const s = issue.subIssuesSummary;
        console.log(`  Sub-issues: ${s.completed}/${s.total} completed (${s.percentCompleted}%)`);
        for (const sub of issue.subIssues.nodes) {
          const mark = sub.state === "CLOSED" ? "[x]" : "[ ]";
          console.log(`    ${mark} #${sub.number} ${sub.title}`);
        }
      } else {
        console.log("  No sub-issues");
      }
    },
  },

  // --- Blocking / Dependencies (GraphQL) ---
  "block:add": {
    description: "Set issue A is blocked by issue B",
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
            addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
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
      console.log(`#${blockedNum} is now blocked by #${blockingNum}`);
    },
  },

  "block:remove": {
    description: "Remove a blocked-by relationship",
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
            removeBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
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
      console.log(`Removed: #${blockedNum} is no longer blocked by #${blockingNum}`);
    },
  },

  // --- Dependency summary (GraphQL) ---
  "deps:show": {
    description: "Show all dependency relationships for an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const repo = need(args[0], "owner/repo");
      const num = need(args[1], "issue-number");
      const id = await issueNodeId(repo, Number(num));
      const data = await graphql(
        `
          query ($id: ID!) {
            node(id: $id) {
              ... on Issue {
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
                blockedBy(first: 20) {
                  nodes {
                    number
                    title
                    state
                  }
                }
                blocking(first: 20) {
                  nodes {
                    number
                    title
                    state
                  }
                }
                trackedInIssues(first: 20) {
                  nodes {
                    number
                    title
                    state
                  }
                }
                trackedIssues(first: 20) {
                  nodes {
                    number
                    title
                    state
                  }
                }
                issueDependenciesSummary {
                  blockedBy
                  blocking
                  totalBlockedBy
                  totalBlocking
                }
              }
            }
          }
        `,
        { id },
      );
      const issue = data.node;
      console.log(`\n#${issue.number} ${issue.title}`);
      console.log("=".repeat(50));

      if (issue.parent) {
        console.log(`\nParent: #${issue.parent.number} (${issue.parent.title})`);
      }

      if (issue.subIssues.nodes.length > 0) {
        const s = issue.subIssuesSummary;
        console.log(`\nSub-issues (${s.completed}/${s.total}):`);
        for (const sub of issue.subIssues.nodes) {
          const mark = sub.state === "CLOSED" ? "[x]" : "[ ]";
          console.log(`  ${mark} #${sub.number} ${sub.title}`);
        }
      }

      if (issue.blockedBy.nodes.length > 0) {
        console.log(`\nBlocked by:`);
        for (const b of issue.blockedBy.nodes) {
          console.log(`  - #${b.number} ${b.title} (${b.state})`);
        }
      }

      if (issue.blocking.nodes.length > 0) {
        console.log(`\nBlocking:`);
        for (const b of issue.blocking.nodes) {
          console.log(`  - #${b.number} ${b.title} (${b.state})`);
        }
      }

      if (issue.trackedInIssues.nodes.length > 0) {
        console.log(`\nTracked in:`);
        for (const t of issue.trackedInIssues.nodes) {
          console.log(`  - #${t.number} ${t.title} (${t.state})`);
        }
      }

      if (issue.trackedIssues.nodes.length > 0) {
        console.log(`\nTracking:`);
        for (const t of issue.trackedIssues.nodes) {
          console.log(`  - #${t.number} ${t.title} (${t.state})`);
        }
      }

      const dep = issue.issueDependenciesSummary;
      if (dep.totalBlockedBy > 0 || dep.totalBlocking > 0) {
        console.log(
          `\nDependency summary: blocked by ${dep.blockedBy} open (${dep.totalBlockedBy} total), blocking ${dep.blocking} open (${dep.totalBlocking} total)`,
        );
      }
    },
  },

  // --- Tracked Issues (read-only via GraphQL) ---
  "tracked:list": {
    description: "List tracked issues and tracking issues for an issue",
    usage: "<owner/repo> <issue-number>",
    run: async (args) => {
      const repo = need(args[0], "owner/repo");
      const num = need(args[1], "issue-number");
      const id = await issueNodeId(repo, Number(num));
      const data = await graphql(
        `
          query ($id: ID!) {
            node(id: $id) {
              ... on Issue {
                number
                title
                trackedIssues(first: 50) {
                  nodes {
                    number
                    title
                    state
                  }
                }
                trackedIssuesCount
                trackedInIssues(first: 50) {
                  nodes {
                    number
                    title
                    state
                  }
                }
              }
            }
          }
        `,
        { id },
      );
      const issue = data.node;
      console.log(`#${issue.number} ${issue.title}`);
      if (issue.trackedIssues.nodes.length > 0) {
        console.log(`\nTracking (${issue.trackedIssuesCount}):`);
        for (const t of issue.trackedIssues.nodes) {
          const mark = t.state === "CLOSED" ? "[x]" : "[ ]";
          console.log(`  ${mark} #${t.number} ${t.title}`);
        }
      }
      if (issue.trackedInIssues.nodes.length > 0) {
        console.log(`\nTracked in:`);
        for (const t of issue.trackedInIssues.nodes) {
          console.log(`  - #${t.number} ${t.title} (${t.state})`);
        }
      }
    },
  },
};

// --- main ---

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === "help") {
  console.log("GitHub Projects CLI\n");
  console.log("Usage: bun gh-project.ts <command> [args]\n");
  console.log("Commands:");
  const maxLen = Math.max(...Object.keys(commands).map((k) => k.length));
  for (const [name, { description, usage }] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${description}`);
    console.log(`  ${"".padEnd(maxLen + 2)} Usage: ${name} ${usage}`);
  }
  console.log("\nPrerequisite: gh auth refresh -s project");
  process.exit(0);
}

const command = commands[cmd];
if (!command) {
  console.error(`Unknown command: ${cmd}`);
  console.error(`Run with 'help' to see available commands.`);
  process.exit(1);
}

await command.run(args);
