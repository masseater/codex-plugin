import { existsSync } from "node:fs";
import { join } from "node:path";
import { finding } from "../../core/finding.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "config-files",
  description: "Checks that required configuration files exist and forbidden lock files are absent",
  references: ["ecosystem.md"],
  appliesTo: [],
  scope: "root",
};

function exists(rootDir: string, ...segments: string[]): boolean {
  return existsSync(join(rootDir, ...segments));
}

function anyExists(rootDir: string, names: string[]): boolean {
  return names.some((name) => exists(rootDir, name));
}

/** 設定ファイルの規則。violated が true になるとき、その severity と message で報告する */
const CONFIG_RULES: {
  severity: Finding["severity"];
  message: string;
  violated: (rootDir: string) => boolean;
}[] = [
  // config/package-manager: no package-lock.json or yarn.lock
  {
    severity: "violation",
    message:
      "package-lock.json found — use pnpm instead of npm (delete package-lock.json and run pnpm install)",
    violated: (rootDir) => exists(rootDir, "package-lock.json"),
  },
  {
    severity: "violation",
    message: "yarn.lock found — use pnpm instead of yarn (delete yarn.lock and run pnpm install)",
    violated: (rootDir) => exists(rootDir, "yarn.lock"),
  },
  // config/tsconfig: tsconfig.json exists
  {
    severity: "warning",
    message: "tsconfig.json not found — add a tsconfig.json to enable TypeScript compiler checks",
    violated: (rootDir) => !exists(rootDir, "tsconfig.json"),
  },
  // config/git-hooks: .husky/ or lefthook config exists
  {
    severity: "warning",
    message: "git hook config not found — add .husky/ or lefthook.yml to manage repository hooks",
    violated: (rootDir) => !anyExists(rootDir, [".husky", "lefthook.yml", ".lefthook.yml"]),
  },
  // config/renovate: .github/renovate.json5
  {
    severity: "warning",
    message:
      "renovate config not found — add .github/renovate.json5 to enable automated dependency updates",
    violated: (rootDir) => !exists(rootDir, ".github", "renovate.json5"),
  },
  // config/tool-versions: .mise.toml or .tool-versions exists
  {
    severity: "warning",
    message:
      "runtime version file not found — add .mise.toml to pin Node.js and other tool versions (prefer .mise.toml over .tool-versions)",
    violated: (rootDir) => !anyExists(rootDir, [".mise.toml", ".tool-versions"]),
  },
];

async function run(ctx: ProjectContext): Promise<Finding[]> {
  return CONFIG_RULES.filter((rule) => rule.violated(ctx.rootDir)).map((rule) =>
    finding(rule.severity, "config-files", rule.message),
  );
}

export { meta, run };
