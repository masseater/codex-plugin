import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "scripts",
  description: "Verifies required npm scripts exist in package.json and use correct tooling",
  references: ["coding-standards.md"],
  appliesTo: [],
  scope: "all",
};

function finding(severity: Finding["severity"], message: string): Finding {
  return { severity, rule: "scripts", file: null, line: null, message };
}

// scripts/check — must exist
function checkScriptFindings(scripts: Record<string, string>): Finding[] {
  if ("check" in scripts) return [];
  return [finding("violation", 'Add a "check" script to package.json (e.g. "biome check")')];
}

// scripts/typecheck — must exist / scripts/typecheck-tsgo — must use tsgo, not tsc
function typecheckFindings(scripts: Record<string, string>): Finding[] {
  if (!("typecheck" in scripts)) {
    return [
      finding("violation", 'Add a "typecheck" script to package.json (e.g. "tsgo --noEmit")'),
    ];
  }
  const typecheckValue = scripts.typecheck ?? "";
  if (typecheckValue.includes("tsgo")) return [];
  return [
    finding(
      "violation",
      `"typecheck" script must use "tsgo" (native TypeScript 7.x) instead of "tsc". Current value: "${typecheckValue}"`,
    ),
  ];
}

async function hasTestFiles(rootDir: string): Promise<boolean> {
  for await (const _ of new Bun.Glob("**/*.test.ts").scan({ cwd: rootDir, onlyFiles: true })) {
    return true;
  }
  return false;
}

// scripts/test-coverage — warning if *.test.ts files exist but script missing
async function coverageFindings(
  rootDir: string,
  scripts: Record<string, string>,
): Promise<Finding[]> {
  if ("test:coverage" in scripts || !existsSync(rootDir)) return [];
  if (!(await hasTestFiles(rootDir))) return [];
  return [
    finding(
      "warning",
      'Add a "test:coverage" script to package.json (e.g. "bun test --coverage"). *.test.ts files were found.',
    ),
  ];
}

// scripts/knip — warning if src/ dir exists but script missing
function knipFindings(rootDir: string, scripts: Record<string, string>): Finding[] {
  if ("knip" in scripts || !existsSync(join(rootDir, "src"))) return [];
  return [
    finding(
      "warning",
      'Add a "knip" script to package.json for unused code detection. A src/ directory was found.',
    ),
  ];
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (ctx.packageJson === null) return [];

  const scripts = ctx.packageJson.scripts ?? {};
  return [
    ...checkScriptFindings(scripts),
    ...typecheckFindings(scripts),
    ...(await coverageFindings(ctx.rootDir, scripts)),
    ...knipFindings(ctx.rootDir, scripts),
  ];
}

export { meta, run };
