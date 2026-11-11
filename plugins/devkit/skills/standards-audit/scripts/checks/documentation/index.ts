import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "documentation",
  description:
    "Checks for required documentation files (AGENTS.md / CLAUDE.md) and auto-collected list markers in monorepos.",
  references: ["documentation.md"],
  appliesTo: [],
  scope: "root",
};

function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const { rootDir } = ctx;

  // docs/agents-md: AGENTS.md or CLAUDE.md must exist at project root
  const hasAgentsMd = existsSync(join(rootDir, "AGENTS.md"));
  const hasClaudeMd = existsSync(join(rootDir, "CLAUDE.md"));

  if (!hasAgentsMd && !hasClaudeMd) {
    findings.push({
      severity: "warning",
      rule: "documentation",
      file: null,
      line: null,
      message:
        "AGENTS.md or CLAUDE.md does not exist at project root. Add one to document project conventions for AI assistants.",
    });
  }

  // docs/auto-collected: only check when pnpm-workspace.yaml exists AND AGENTS.md exists
  const hasPnpmWorkspace = existsSync(join(rootDir, "pnpm-workspace.yaml"));

  if (hasPnpmWorkspace && hasAgentsMd) {
    const content = readFileSync(join(rootDir, "AGENTS.md"), "utf-8");
    if (!content.includes("<!-- BEGIN:")) {
      findings.push({
        severity: "warning",
        rule: "documentation",
        file: "AGENTS.md",
        line: null,
        message:
          "AGENTS.md in monorepo root is missing auto-collected list markers (<!-- BEGIN: ... --> / <!-- END: ... -->). Add them so lists like plugin/package inventories stay in sync automatically.",
      });
    }
  }

  return Promise.resolve(findings);
}

export { meta, run };
