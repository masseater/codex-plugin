import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "config-files",
  description: "Checks that required configuration files exist and forbidden lock files are absent",
  references: ["ecosystem.md"],
  appliesTo: [],
  scope: "root",
};

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  // config/package-manager: no package-lock.json or yarn.lock
  if (existsSync(join(ctx.rootDir, "package-lock.json"))) {
    findings.push({
      severity: "violation",
      rule: "config-files",
      file: null,
      line: null,
      message:
        "package-lock.json found — use pnpm instead of npm (delete package-lock.json and run pnpm install)",
    });
  }

  if (existsSync(join(ctx.rootDir, "yarn.lock"))) {
    findings.push({
      severity: "violation",
      rule: "config-files",
      file: null,
      line: null,
      message: "yarn.lock found — use pnpm instead of yarn (delete yarn.lock and run pnpm install)",
    });
  }

  // config/tsconfig: tsconfig.json exists
  if (!existsSync(join(ctx.rootDir, "tsconfig.json"))) {
    findings.push({
      severity: "warning",
      rule: "config-files",
      file: null,
      line: null,
      message: "tsconfig.json not found — add a tsconfig.json to enable TypeScript compiler checks",
    });
  }

  // config/git-hooks: .husky/ or lefthook config exists
  const hasGitHooks =
    existsSync(join(ctx.rootDir, ".husky")) ||
    existsSync(join(ctx.rootDir, "lefthook.yml")) ||
    existsSync(join(ctx.rootDir, ".lefthook.yml"));

  if (!hasGitHooks) {
    findings.push({
      severity: "warning",
      rule: "config-files",
      file: null,
      line: null,
      message: "git hook config not found — add .husky/ or lefthook.yml to manage repository hooks",
    });
  }

  // config/renovate: .github/renovate.json5
  if (!existsSync(join(ctx.rootDir, ".github", "renovate.json5"))) {
    findings.push({
      severity: "warning",
      rule: "config-files",
      file: null,
      line: null,
      message:
        "renovate config not found — add .github/renovate.json5 to enable automated dependency updates",
    });
  }

  // config/tool-versions: .mise.toml or .tool-versions exists
  const hasToolVersions =
    existsSync(join(ctx.rootDir, ".mise.toml")) || existsSync(join(ctx.rootDir, ".tool-versions"));

  if (!hasToolVersions) {
    findings.push({
      severity: "warning",
      rule: "config-files",
      file: null,
      line: null,
      message:
        "runtime version file not found — add .mise.toml to pin Node.js and other tool versions (prefer .mise.toml over .tool-versions)",
    });
  }

  return findings;
}

export { meta, run };
