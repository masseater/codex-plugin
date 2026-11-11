import { existsSync } from "node:fs";
import { join } from "node:path";
import { finding } from "../../core/finding.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "monorepo",
  description: "Monorepo structure and workspace conventions",
  references: ["ecosystem.md"],
  appliesTo: [],
  scope: "all",
};

function checkRoot(ctx: ProjectContext): Finding[] {
  const findings: Finding[] = [];

  if (!existsSync(join(ctx.rootDir, "pnpm-workspace.yaml"))) {
    findings.push({
      severity: "violation",
      rule: "monorepo",
      file: null,
      line: null,
      message: "pnpm-workspace.yaml not found at root. Add it to define workspace packages.",
    });
  }

  if (!existsSync(join(ctx.rootDir, "turbo.json"))) {
    findings.push({
      severity: "warning",
      rule: "monorepo",
      file: null,
      line: null,
      message: "turbo.json not found at root. Add Turborepo for task orchestration and caching.",
    });
  }

  return findings;
}

function workspaceProtocolFindings(allDeps: Record<string, string>): Finding[] {
  return Object.entries(allDeps)
    .filter(([name, version]) => name.startsWith("@repo/") && !version.startsWith("workspace:"))
    .map(([name, version]) =>
      finding(
        "violation",
        "monorepo",
        `${name} must use workspace: protocol (found "${version}"). Change to "workspace:*".`,
        { file: "package.json" },
      ),
    );
}

function missingScriptFindings(scripts: Record<string, string>): Finding[] {
  return (["check", "typecheck"] as const)
    .filter((script) => !(script in scripts))
    .map((script) =>
      finding(
        "warning",
        "monorepo",
        `Missing "${script}" script. Add it so the monorepo pipeline can run this workspace.`,
        { file: "package.json" },
      ),
    );
}

function checkWorkspace(ctx: ProjectContext): Finding[] {
  if (ctx.packageJson === null) return [];
  const allDeps: Record<string, string> = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };
  return [
    ...workspaceProtocolFindings(allDeps),
    ...missingScriptFindings(ctx.packageJson.scripts ?? {}),
  ];
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (ctx.label === "(root)") {
    return checkRoot(ctx);
  }
  return checkWorkspace(ctx);
}

export { meta, run };
