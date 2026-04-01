import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), "ci-check-test-"));
}

function makeContext(rootDir: string): ProjectContext {
  return {
    rootDir,
    label: "(root)",
    types: [],
    packageJson: null,
  };
}

function writeWorkflow(rootDir: string, filename: string, content: string): void {
  const workflowsDir = join(rootDir, ".github", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(join(workflowsDir, filename), content);
}

describe("ci check meta", () => {
  test("has correct name and scope", () => {
    expect(meta.name).toBe("ci");
    expect(meta.scope).toBe("root");
    expect(meta.appliesTo).toEqual([]);
  });
});

describe("ci check: no workflows directory", () => {
  test("reports workflow-exists warning and no other findings", async () => {
    const rootDir = makeTempProject();
    const findings = await run(makeContext(rootDir));

    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe("ci");
    expect(findings[0]!.severity).toBe("warning");
    expect(findings[0]!.file).toBeNull();
    expect(findings[0]!.line).toBeNull();
    const ruleIds = findings.map((f) => f.message);
    expect(ruleIds.some((m) => m.includes("ci/workflow-exists"))).toBe(true);
  });
});

describe("ci check: workflow exists but missing steps", () => {
  test("no workflow-exists warning when .yml files present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n",
    );

    const findings = await run(makeContext(rootDir));
    const workflowExistsFindings = findings.filter((f) => f.message.includes("ci/workflow-exists"));
    expect(workflowExistsFindings).toHaveLength(0);
  });

  test("reports lint-step warning when no check/lint keyword", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  build:\n    steps:\n      - run: echo hello\n",
    );

    const findings = await run(makeContext(rootDir));
    const lintFindings = findings.filter((f) => f.message.includes("ci/lint-step"));
    expect(lintFindings).toHaveLength(1);
    expect(lintFindings[0]!.severity).toBe("warning");
  });

  test("reports typecheck-step warning when no typecheck keyword", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  build:\n    steps:\n      - run: echo hello\n",
    );

    const findings = await run(makeContext(rootDir));
    const typecheckFindings = findings.filter((f) => f.message.includes("ci/typecheck-step"));
    expect(typecheckFindings).toHaveLength(1);
    expect(typecheckFindings[0]!.severity).toBe("warning");
  });

  test("reports test-step warning when no test keyword", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  build:\n    steps:\n      - run: echo hello\n",
    );

    const findings = await run(makeContext(rootDir));
    const testFindings = findings.filter((f) => f.message.includes("ci/test-step"));
    expect(testFindings).toHaveLength(1);
    expect(testFindings[0]!.severity).toBe("warning");
  });

  test("reports knip-step warning when no knip keyword", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  build:\n    steps:\n      - run: echo hello\n",
    );

    const findings = await run(makeContext(rootDir));
    const knipFindings = findings.filter((f) => f.message.includes("ci/knip-step"));
    expect(knipFindings).toHaveLength(1);
    expect(knipFindings[0]!.severity).toBe("warning");
  });

  test("empty workflow dir (no .yml/.yaml files) reports workflow-exists and skips others", async () => {
    const rootDir = makeTempProject();
    const workflowsDir = join(rootDir, ".github", "workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, "README.md"), "# workflows\n");

    const findings = await run(makeContext(rootDir));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("ci/workflow-exists");
  });
});

describe("ci check: keyword detection", () => {
  test("no lint warning when 'check' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  lint:\n    steps:\n      - run: bun run check\n",
    );

    const findings = await run(makeContext(rootDir));
    const lintFindings = findings.filter((f) => f.message.includes("ci/lint-step"));
    expect(lintFindings).toHaveLength(0);
  });

  test("no lint warning when 'lint' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  lint:\n    steps:\n      - run: bun run lint\n",
    );

    const findings = await run(makeContext(rootDir));
    const lintFindings = findings.filter((f) => f.message.includes("ci/lint-step"));
    expect(lintFindings).toHaveLength(0);
  });

  test("no typecheck warning when 'typecheck' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  typecheck:\n    steps:\n      - run: bun run typecheck\n",
    );

    const findings = await run(makeContext(rootDir));
    const typecheckFindings = findings.filter((f) => f.message.includes("ci/typecheck-step"));
    expect(typecheckFindings).toHaveLength(0);
  });

  test("no test warning when 'test:coverage' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  test:\n    steps:\n      - run: bun run test:coverage\n",
    );

    const findings = await run(makeContext(rootDir));
    const testFindings = findings.filter((f) => f.message.includes("ci/test-step"));
    expect(testFindings).toHaveLength(0);
  });

  test("no test warning when 'test' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  test:\n    steps:\n      - run: bun run test\n",
    );

    const findings = await run(makeContext(rootDir));
    const testFindings = findings.filter((f) => f.message.includes("ci/test-step"));
    expect(testFindings).toHaveLength(0);
  });

  test("no knip warning when 'knip' keyword present", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  knip:\n    steps:\n      - run: bun run knip\n",
    );

    const findings = await run(makeContext(rootDir));
    const knipFindings = findings.filter((f) => f.message.includes("ci/knip-step"));
    expect(knipFindings).toHaveLength(0);
  });

  test("searches across multiple workflow files", async () => {
    const rootDir = makeTempProject();
    // lint in one file, typecheck+test+knip in another
    writeWorkflow(
      rootDir,
      "lint.yml",
      "name: Lint\njobs:\n  lint:\n    steps:\n      - run: bun run check\n",
    );
    writeWorkflow(
      rootDir,
      "ci.yml",
      "name: CI\njobs:\n  test:\n    steps:\n      - run: bun run typecheck\n      - run: bun run test:coverage\n      - run: bun run knip\n",
    );

    const findings = await run(makeContext(rootDir));
    expect(findings).toHaveLength(0);
  });

  test("accepts .yaml extension in addition to .yml", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yaml",
      "name: CI\njobs:\n  all:\n    steps:\n      - run: bun run check\n      - run: bun run typecheck\n      - run: bun run test:coverage\n      - run: bun run knip\n",
    );

    const findings = await run(makeContext(rootDir));
    expect(findings).toHaveLength(0);
  });
});

describe("ci check: all steps present", () => {
  test("no findings when workflow contains all required steps", async () => {
    const rootDir = makeTempProject();
    writeWorkflow(
      rootDir,
      "ci.yml",
      [
        "name: CI",
        "on: push",
        "jobs:",
        "  ci:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - run: bun run check",
        "      - run: bun run typecheck",
        "      - run: bun run test:coverage",
        "      - run: bun run knip",
      ].join("\n"),
    );

    const findings = await run(makeContext(rootDir));
    expect(findings).toHaveLength(0);
  });
});
