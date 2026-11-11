import { finding } from "../../core/finding.ts";
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

type DevDeps = Record<string, string> | undefined;

/** 品質ツールの規則。violated が true になるとき、その severity と message で報告する */
const QUALITY_RULES: {
  severity: Finding["severity"];
  message: string;
  violated: (devDeps: DevDeps) => boolean;
}[] = [
  // quality/linter — oxlint OR @biomejs/biome
  {
    severity: "warning",
    message: "No linter found in devDependencies. Add oxlint or @biomejs/biome.",
    violated: (devDeps) => !hasDep(devDeps, "oxlint") && !hasDep(devDeps, "@biomejs/biome"),
  },
  // quality/tsgo — @typescript/native-preview
  {
    severity: "warning",
    message:
      "@typescript/native-preview not found in devDependencies. Add it to enable the native TypeScript compiler (tsgo).",
    violated: (devDeps) => !hasDep(devDeps, "@typescript/native-preview"),
  },
  // quality/vitest — vitest
  {
    severity: "warning",
    message: "vitest not found in devDependencies. Add vitest for testing.",
    violated: (devDeps) => !hasDep(devDeps, "vitest"),
  },
  // quality/knip — knip
  {
    severity: "warning",
    message: "knip not found in devDependencies. Add knip for unused code detection.",
    violated: (devDeps) => !hasDep(devDeps, "knip"),
  },
  // quality/eslint-oxlint — if both oxlint AND eslint exist, eslint-plugin-oxlint must also be present
  {
    severity: "violation",
    message:
      "Both oxlint and eslint are present in devDependencies, but eslint-plugin-oxlint is missing. Add eslint-plugin-oxlint to avoid rule conflicts.",
    violated: (devDeps) =>
      hasDep(devDeps, "oxlint") &&
      hasDep(devDeps, "eslint") &&
      !hasDep(devDeps, "eslint-plugin-oxlint"),
  },
];

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const devDeps = ctx.packageJson?.devDependencies;
  return QUALITY_RULES.filter((rule) => rule.violated(devDeps)).map((rule) =>
    finding(rule.severity, "quality-libs", rule.message),
  );
}

export { meta, run };
