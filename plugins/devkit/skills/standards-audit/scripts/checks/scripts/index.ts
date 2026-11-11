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

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (ctx.packageJson === null) return [];

  const scripts = ctx.packageJson.scripts ?? {};
  const findings: Finding[] = [];

  function violation(message: string): Finding {
    return {
      severity: "violation",
      rule: "scripts",
      file: null,
      line: null,
      message,
    };
  }

  function warning(message: string): Finding {
    return {
      severity: "warning",
      rule: "scripts",
      file: null,
      line: null,
      message,
    };
  }

  // scripts/check — must exist
  if (!("check" in scripts)) {
    findings.push(violation('Add a "check" script to package.json (e.g. "biome check")'));
  }

  // scripts/typecheck — must exist
  if (!("typecheck" in scripts)) {
    findings.push(violation('Add a "typecheck" script to package.json (e.g. "tsgo --noEmit")'));
  } else {
    // scripts/typecheck-tsgo — must use tsgo, not tsc
    const typecheckValue = scripts.typecheck ?? "";
    if (!typecheckValue.includes("tsgo")) {
      findings.push(
        violation(
          `"typecheck" script must use "tsgo" (native TypeScript 7.x) instead of "tsc". Current value: "${typecheckValue}"`,
        ),
      );
    }
  }

  // scripts/test-coverage — warning if *.test.ts files exist but script missing
  if (!("test:coverage" in scripts) && existsSync(ctx.rootDir)) {
    const glob = new Bun.Glob("**/*.test.ts");
    let hasTestFiles = false;
    for await (const _ of glob.scan({ cwd: ctx.rootDir, onlyFiles: true })) {
      hasTestFiles = true;
      break;
    }
    if (hasTestFiles) {
      findings.push(
        warning(
          'Add a "test:coverage" script to package.json (e.g. "bun test --coverage"). *.test.ts files were found.',
        ),
      );
    }
  }

  // scripts/knip — warning if src/ dir exists but script missing
  if (!("knip" in scripts)) {
    if (existsSync(join(ctx.rootDir, "src"))) {
      findings.push(
        warning(
          'Add a "knip" script to package.json for unused code detection. A src/ directory was found.',
        ),
      );
    }
  }

  return findings;
}

export { meta, run };
