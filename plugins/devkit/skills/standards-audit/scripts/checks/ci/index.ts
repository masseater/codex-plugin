import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { finding } from "../../core/finding.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const meta: CheckMeta = {
  name: "ci",
  description:
    "Checks that CI workflows exist and include required steps (lint, typecheck, test, knip).",
  references: ["quality-automation.md"],
  appliesTo: [],
  scope: "root",
};

function isWorkflowFile(file: string): boolean {
  return file.endsWith(".yml") || file.endsWith(".yaml");
}

function readWorkflow(workflowsDir: string, file: string): string {
  try {
    return readFileSync(join(workflowsDir, file), "utf-8");
  } catch (error) {
    // 読めない workflow は内容なしとして扱い、他の workflow の内容で検査を続ける
    if (process.env.DEBUG) console.error(`[debug] skipped unreadable workflow ${file}:`, error);
    return "";
  }
}

function readWorkflowContents(rootDir: string): string[] | null {
  const workflowsDir = join(rootDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return null;

  const files = readdirSync(workflowsDir).filter(isWorkflowFile);
  if (files.length === 0) return null;
  return files.map((file) => readWorkflow(workflowsDir, file));
}

/** workflow に含まれているべき手順と、見つからないときのメッセージ */
const CI_STEP_RULES: { pattern: RegExp; message: string }[] = [
  {
    pattern: /check|lint/i,
    message:
      "ci/lint-step: No lint or check step found in CI workflows. Add a step running 'bun run check' or equivalent.",
  },
  {
    pattern: /typecheck/i,
    message:
      "ci/typecheck-step: No typecheck step found in CI workflows. Add a step running 'bun run typecheck' or equivalent.",
  },
  {
    pattern: /test:coverage|test/i,
    message:
      "ci/test-step: No test step found in CI workflows. Add a step running 'bun run test:coverage' or equivalent.",
  },
  {
    pattern: /knip/i,
    message:
      "ci/knip-step: No knip step found in CI workflows. Add a step running 'bun run knip' or equivalent.",
  },
];

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const contents = readWorkflowContents(ctx.rootDir);
  if (contents === null) {
    return [
      finding(
        "warning",
        "ci",
        "ci/workflow-exists: No workflow files found in .github/workflows/. Add a CI workflow with lint, typecheck, test, and knip steps.",
      ),
    ];
  }

  const combined = contents.join("\n");
  return CI_STEP_RULES.filter((rule) => !rule.pattern.test(combined)).map((rule) =>
    finding("warning", "ci", rule.message),
  );
}

export { meta, run };
