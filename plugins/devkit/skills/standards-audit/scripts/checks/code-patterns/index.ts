import { grepProject } from "../../core/grep.ts";
import { finding } from "../../core/finding.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "code-patterns",
  description:
    "Detects forbidden code patterns: env validation bypasses and direct process.env access",
  references: ["coding-standards.md"],
  appliesTo: [],
  scope: "workspace",
};

const COMMENT_PREFIXES = ["//", "/*", "*", "*/"];

function isCommentLine(content: string): boolean {
  const trimmed = content.trim();
  return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

// code/no-skip-env: detect skipValidation, skipEnvValidation, SKIP_ENV
async function skipEnvFindings(rootDir: string): Promise<Finding[]> {
  const matches = await grepProject(
    rootDir,
    "skipValidation|skipEnvValidation|SKIP_ENV",
    "**/*.ts",
    ["node_modules", "dist"],
  );
  return matches.map((match) =>
    finding(
      "violation",
      "code/no-skip-env",
      `Env validation bypass detected (${match.content.trim()}). Remove skipValidation/skipEnvValidation/SKIP_ENV usage.`,
      match,
    ),
  );
}

// code/no-direct-process-env: detect process.env. access outside allowed files
async function processEnvFindings(rootDir: string): Promise<Finding[]> {
  const matches = await grepProject(rootDir, "process\\.env\\.", "**/*.ts", [
    "**/env.ts",
    "**/*.config.*",
    "**/*.d.ts",
    "**/*.test.*",
  ]);
  return matches
    .filter((match) => !isCommentLine(match.content))
    .map((match) =>
      finding(
        "violation",
        "code/no-direct-process-env",
        `Direct process.env access detected (${match.content.trim()}). Move env reads into env.ts or another typed boundary module.`,
        match,
      ),
    );
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  return [...(await skipEnvFindings(ctx.rootDir)), ...(await processEnvFindings(ctx.rootDir))];
}

export { meta, run };
