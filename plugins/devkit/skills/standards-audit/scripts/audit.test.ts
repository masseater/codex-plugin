import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit } from "./audit.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "audit-e2e-"));
}

function writeJson(dir: string, filename: string, data: unknown): void {
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
}

describe("audit", () => {
  test("non-Node.js project returns early with no findings", async () => {
    const dir = makeTempDir();
    // No package.json
    const result = await audit(dir);
    expect(result.scopeResults[0]!.findings).toHaveLength(0);
  });

  test("minimal project reports missing config and scripts", async () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", {
      name: "minimal-app",
      scripts: {},
      devDependencies: {},
    });

    const result = await audit(dir);
    const allFindings = result.scopeResults.flatMap((sr) => sr.findings);

    // Should report missing scripts (check, typecheck)
    const scriptFindings = allFindings.filter((f) => f.rule === "scripts");
    expect(scriptFindings.length).toBeGreaterThanOrEqual(2);

    // Should report missing quality libs
    const qualityFindings = allFindings.filter((f) => f.rule === "quality-libs");
    expect(qualityFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("well-configured project has fewer findings", async () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", {
      name: "good-app",
      scripts: {
        check: "biome check",
        "check:fix": "biome check --write",
        typecheck: "tsgo --noEmit",
        "test:coverage": "vitest run --coverage",
        knip: "knip",
      },
      devDependencies: {
        "@biomejs/biome": "^2.3.8",
        "@typescript/native-preview": "^7.0.0",
        vitest: "^2.0.0",
        knip: "^5.0.0",
      },
    });
    writeJson(dir, "tsconfig.json", {});
    writeFileSync(join(dir, "lefthook.yml"), "pre-commit:\n  commands: {}\n");
    writeFileSync(join(dir, ".mise.toml"), '[tools]\nnode = "22.0.0"\npnpm = "10.0.0"\n');
    writeFileSync(join(dir, "renovate.json"), '{ "extends": ["config:base"] }\n');

    const result = await audit(dir);
    const allFindings = result.scopeResults.flatMap((sr) => sr.findings);
    const violations = allFindings.filter((f) => f.severity === "violation");

    // Well-configured project should have no script/quality violations
    const scriptViolations = violations.filter((f) => f.rule === "scripts");
    expect(scriptViolations).toHaveLength(0);
  });

  test("monorepo detects workspaces and checks each", async () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", { name: "monorepo-root" });
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');
    writeFileSync(join(dir, "turbo.json"), '{ "tasks": {} }\n');

    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    writeJson(join(dir, "apps", "web"), "package.json", {
      name: "@repo/web",
      scripts: { check: "biome check", typecheck: "tsgo --noEmit" },
      dependencies: { next: "^15.0.0" },
    });

    const result = await audit(dir);
    expect(result.workspace.isMonorepo).toBe(true);
    expect(result.scopeResults.length).toBeGreaterThanOrEqual(2);

    // Web workspace should have web-specific context
    const webScope = result.scopeResults.find((sr) => sr.scope.label === "apps/web");
    expect(webScope).toBeDefined();
  });
});
