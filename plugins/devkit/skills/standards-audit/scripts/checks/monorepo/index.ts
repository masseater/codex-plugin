import { existsSync } from "node:fs";
import { join } from "node:path";
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

function checkWorkspace(ctx: ProjectContext): Finding[] {
  if (ctx.packageJson === null) return [];

  const findings: Finding[] = [];

  const allDeps: Record<string, string> = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    if (name.startsWith("@repo/") && !version.startsWith("workspace:")) {
      findings.push({
        severity: "violation",
        rule: "monorepo",
        file: "package.json",
        line: null,
        message: `${name} must use workspace: protocol (found "${version}"). Change to "workspace:*".`,
      });
    }
  }

  const scripts = ctx.packageJson.scripts ?? {};

  for (const script of ["check", "typecheck"] as const) {
    if (!(script in scripts)) {
      findings.push({
        severity: "warning",
        rule: "monorepo",
        file: "package.json",
        line: null,
        message: `Missing "${script}" script. Add it so the monorepo pipeline can run this workspace.`,
      });
    }
  }

  return findings;
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (ctx.label === "(root)") {
    return checkRoot(ctx);
  }
  return checkWorkspace(ctx);
}

export { meta, run };
