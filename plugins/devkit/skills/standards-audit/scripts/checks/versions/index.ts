import { finding } from "../../core/finding.ts";
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

function versionFindings(check: VersionCheck, range: string | undefined): Finding[] {
  if (range === undefined || !isBelow(parseVersion(range), check.min)) return [];
  return [
    finding(
      "warning",
      "versions",
      `${check.label} must be >= ${check.min.join(".")} (found "${range}"). Upgrade to meet the minimum version requirement.`,
    ),
  ];
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  if (!ctx.packageJson) return [];

  const allDeps: Record<string, string> = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };
  return VERSION_CHECKS.flatMap((check) => versionFindings(check, allDeps[check.pkg]));
}

export { meta, run };
