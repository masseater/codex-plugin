import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "ci",
  description:
    "Checks that CI workflows exist and include required steps (lint, typecheck, test, knip).",
  references: ["quality-automation.md"],
  appliesTo: [],
  scope: "root",
};

function readWorkflowContents(rootDir: string): string[] | null {
  const workflowsDir = join(rootDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return null;

  const entries = readdirSync(workflowsDir);
  const files = entries.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  if (files.length === 0) return null;

  return files.map((f) => {
    try {
      return readFileSync(join(workflowsDir, f), "utf-8");
    } catch {
      return "";
    }
  });
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  const contents = readWorkflowContents(ctx.rootDir);

  if (contents === null) {
    findings.push({
      severity: "warning",
      rule: "ci",
      file: null,
      line: null,
      message:
        "ci/workflow-exists: No workflow files found in .github/workflows/. Add a CI workflow with lint, typecheck, test, and knip steps.",
    });
    return findings;
  }

  const combined = contents.join("\n");

  if (!/check|lint/i.test(combined)) {
    findings.push({
      severity: "warning",
      rule: "ci",
      file: null,
      line: null,
      message:
        "ci/lint-step: No lint or check step found in CI workflows. Add a step running 'bun run check' or equivalent.",
    });
  }

  if (!/typecheck/i.test(combined)) {
    findings.push({
      severity: "warning",
      rule: "ci",
      file: null,
      line: null,
      message:
        "ci/typecheck-step: No typecheck step found in CI workflows. Add a step running 'bun run typecheck' or equivalent.",
    });
  }

  if (!/test:coverage|test/i.test(combined)) {
    findings.push({
      severity: "warning",
      rule: "ci",
      file: null,
      line: null,
      message:
        "ci/test-step: No test step found in CI workflows. Add a step running 'bun run test:coverage' or equivalent.",
    });
  }

  if (!/knip/i.test(combined)) {
    findings.push({
      severity: "warning",
      rule: "ci",
      file: null,
      line: null,
      message:
        "ci/knip-step: No knip step found in CI workflows. Add a step running 'bun run knip' or equivalent.",
    });
  }

  return findings;
}

export { meta, run };
