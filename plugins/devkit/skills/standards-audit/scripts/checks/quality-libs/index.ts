import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "quality-libs",
  description:
    "Checks that standard quality tooling (linter, tsgo, vitest, knip) is present in devDependencies, and that eslint-plugin-oxlint bridges oxlint with eslint when both are used together.",
  references: ["quality-automation.md"],
  appliesTo: [],
  scope: "root",
};

function hasDep(devDeps: Record<string, string> | undefined, pkg: string): boolean {
  return Object.hasOwn(devDeps ?? {}, pkg);
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const devDeps = ctx.packageJson?.devDependencies;

  // quality/linter — oxlint OR @biomejs/biome
  const hasLinter = hasDep(devDeps, "oxlint") || hasDep(devDeps, "@biomejs/biome");
  if (!hasLinter) {
    findings.push({
      severity: "warning",
      rule: "quality-libs",
      file: null,
      line: null,
      message: "No linter found in devDependencies. Add oxlint or @biomejs/biome.",
    });
  }

  // quality/tsgo — @typescript/native-preview
  if (!hasDep(devDeps, "@typescript/native-preview")) {
    findings.push({
      severity: "warning",
      rule: "quality-libs",
      file: null,
      line: null,
      message:
        "@typescript/native-preview not found in devDependencies. Add it to enable the native TypeScript compiler (tsgo).",
    });
  }

  // quality/vitest — vitest
  if (!hasDep(devDeps, "vitest")) {
    findings.push({
      severity: "warning",
      rule: "quality-libs",
      file: null,
      line: null,
      message: "vitest not found in devDependencies. Add vitest for testing.",
    });
  }

  // quality/knip — knip
  if (!hasDep(devDeps, "knip")) {
    findings.push({
      severity: "warning",
      rule: "quality-libs",
      file: null,
      line: null,
      message: "knip not found in devDependencies. Add knip for unused code detection.",
    });
  }

  // quality/eslint-oxlint — if both oxlint AND eslint exist, eslint-plugin-oxlint must also be present
  const hasOxlint = hasDep(devDeps, "oxlint");
  const hasEslint = hasDep(devDeps, "eslint");
  const hasEslintPluginOxlint = hasDep(devDeps, "eslint-plugin-oxlint");
  if (hasOxlint && hasEslint && !hasEslintPluginOxlint) {
    findings.push({
      severity: "violation",
      rule: "quality-libs",
      file: null,
      line: null,
      message:
        "Both oxlint and eslint are present in devDependencies, but eslint-plugin-oxlint is missing. Add eslint-plugin-oxlint to avoid rule conflicts.",
    });
  }

  return findings;
}

export { meta, run };
