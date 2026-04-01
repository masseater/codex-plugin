import { grepProject } from "../../core/grep.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "code-patterns",
  description:
    "Detects forbidden code patterns: env validation bypasses and direct process.env access",
  references: ["coding-standards.md"],
  appliesTo: [],
  scope: "workspace",
};

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  // code/no-skip-env: detect skipValidation, skipEnvValidation, SKIP_ENV
  const skipMatches = await grepProject(
    ctx.rootDir,
    "skipValidation|skipEnvValidation|SKIP_ENV",
    "**/*.ts",
    ["node_modules", "dist"],
  );

  for (const match of skipMatches) {
    findings.push({
      severity: "violation",
      rule: "code/no-skip-env",
      file: match.file,
      line: match.line,
      message: `Env validation bypass detected (${match.content.trim()}). Remove skipValidation/skipEnvValidation/SKIP_ENV usage.`,
    });
  }

  // code/no-direct-process-env: detect process.env. access outside allowed files
  const processEnvMatches = await grepProject(ctx.rootDir, "process\\.env\\.", "**/*.ts", [
    "**/env.ts",
    "**/*.config.*",
    "**/*.d.ts",
    "**/*.test.*",
  ]);

  for (const match of processEnvMatches) {
    findings.push({
      severity: "warning",
      rule: "code/no-direct-process-env",
      file: match.file,
      line: match.line,
      message: `Direct process.env access detected (${match.content.trim()}). Use a typed env module instead (e.g., import { env } from "./env").`,
    });
  }

  return findings;
}

export { meta, run };
