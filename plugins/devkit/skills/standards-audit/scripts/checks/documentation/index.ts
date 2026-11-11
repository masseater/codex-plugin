import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "../../core/finding.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "documentation",
  description:
    "Checks for required documentation files (AGENTS.md / CLAUDE.md) and auto-collected list markers in monorepos.",
  references: ["documentation.md"],
  appliesTo: [],
  scope: "root",
};

// docs/agents-md: AGENTS.md or CLAUDE.md must exist at project root
function instructionsFileFindings(hasInstructionsFile: boolean): Finding[] {
  if (hasInstructionsFile) return [];
  return [
    finding(
      "warning",
      "documentation",
      "AGENTS.md or CLAUDE.md does not exist at project root. Add one to document project conventions for AI assistants.",
    ),
  ];
}

// docs/auto-collected: only check when pnpm-workspace.yaml exists AND AGENTS.md exists
function autoCollectedFindings(rootDir: string, hasAgentsMd: boolean): Finding[] {
  if (!hasAgentsMd || !existsSync(join(rootDir, "pnpm-workspace.yaml"))) return [];
  if (readFileSync(join(rootDir, "AGENTS.md"), "utf-8").includes("<!-- BEGIN:")) return [];
  return [
    finding(
      "warning",
      "documentation",
      "AGENTS.md in monorepo root is missing auto-collected list markers (<!-- BEGIN: ... --> / <!-- END: ... -->). Add them so lists like plugin/package inventories stay in sync automatically.",
      { file: "AGENTS.md" },
    ),
  ];
}

function run(ctx: ProjectContext): Promise<Finding[]> {
  const { rootDir } = ctx;
  const hasAgentsMd = existsSync(join(rootDir, "AGENTS.md"));
  const hasClaudeMd = existsSync(join(rootDir, "CLAUDE.md"));
  return Promise.resolve([
    ...instructionsFileFindings(hasAgentsMd || hasClaudeMd),
    ...autoCollectedFindings(rootDir, hasAgentsMd),
  ]);
}

export { meta, run };
