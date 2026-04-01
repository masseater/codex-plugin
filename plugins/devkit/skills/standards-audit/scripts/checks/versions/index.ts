import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "versions",
  description: "Checks that installed toolchain packages meet minimum version requirements.",
  references: ["quality-automation.md"],
  appliesTo: [],
  scope: "root",
};

function parseVersion(range: string): [number, number, number] {
  const match = range.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isBelow(actual: [number, number, number], min: [number, number, number]): boolean {
  const [aMaj, aMin, aPat] = actual;
  const [mMaj, mMin, mPat] = min;
  if (aMaj !== mMaj) return aMaj < mMaj;
  if (aMin !== mMin) return aMin < mMin;
  return aPat < mPat;
}

type VersionCheck = {
  pkg: string;
  min: [number, number, number];
  label: string;
};

const VERSION_CHECKS: VersionCheck[] = [
  { pkg: "@biomejs/biome", min: [2, 0, 0], label: "@biomejs/biome" },
  {
    pkg: "@typescript/native-preview",
    min: [7, 0, 0],
    label: "@typescript/native-preview",
  },
  { pkg: "eslint", min: [9, 0, 0], label: "eslint" },
];

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (!ctx.packageJson) return [];

  const allDeps: Record<string, string> = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };

  const findings: Finding[] = [];

  for (const check of VERSION_CHECKS) {
    const range = allDeps[check.pkg];
    if (range === undefined) continue;

    const actual = parseVersion(range);
    if (isBelow(actual, check.min)) {
      const minStr = check.min.join(".");
      findings.push({
        severity: "warning",
        rule: "versions",
        file: null,
        line: null,
        message: `${check.label} must be >= ${minStr} (found "${range}"). Upgrade to meet the minimum version requirement.`,
      });
    }
  }

  return findings;
}

export { meta, run };
