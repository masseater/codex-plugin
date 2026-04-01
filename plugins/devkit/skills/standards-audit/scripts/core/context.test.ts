import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceInfo, detectProjectTypes, parsePnpmWorkspaceYaml } from "./context.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "audit-test-"));
}

function writeJson(dir: string, filename: string, data: unknown): void {
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2));
}

describe("detectProjectTypes", () => {
  test("returns empty for no deps", () => {
    expect(detectProjectTypes({})).toEqual([]);
  });

  test("detects web from next dependency", () => {
    expect(detectProjectTypes({ next: "^15.0.0" })).toContain("web");
  });

  test("detects backend from hono dependency", () => {
    expect(detectProjectTypes({ hono: "^4.0.0" })).toContain("backend");
  });

  test("detects cli from citty dependency", () => {
    expect(detectProjectTypes({ citty: "^0.1.6" })).toContain("cli");
  });

  test("detects multiple types", () => {
    const types = detectProjectTypes({ next: "^15.0.0", hono: "^4.0.0" });
    expect(types).toContain("web");
    expect(types).toContain("backend");
  });

  test("ignores unrelated deps", () => {
    expect(detectProjectTypes({ lodash: "^4.0.0" })).toEqual([]);
  });
});

describe("parsePnpmWorkspaceYaml", () => {
  test("parses simple workspace config", () => {
    const yaml = `packages:\n  - "apps/*"\n  - "packages/*"\n`;
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["apps/*", "packages/*"]);
  });

  test("parses without quotes", () => {
    const yaml = `packages:\n  - apps/*\n  - packages/*\n`;
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["apps/*", "packages/*"]);
  });

  test("parses single-quoted", () => {
    const yaml = `packages:\n  - 'apps/*'\n  - 'packages/*'\n`;
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["apps/*", "packages/*"]);
  });

  test("stops at next top-level key", () => {
    const yaml = `packages:\n  - apps/*\ncatalog:\n  react: ^19\n`;
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["apps/*"]);
  });

  test("returns empty for no packages key", () => {
    expect(parsePnpmWorkspaceYaml("something: else\n")).toEqual([]);
  });

  test("returns empty for empty string", () => {
    expect(parsePnpmWorkspaceYaml("")).toEqual([]);
  });
});

describe("buildWorkspaceInfo", () => {
  test("returns early for non-Node.js project (no package.json)", () => {
    const dir = makeTempDir();
    const info = buildWorkspaceInfo(dir);
    expect(info.isMonorepo).toBe(false);
    expect(info.scopes).toHaveLength(1);
    expect(info.scopes[0]!.packageJson).toBeNull();
    expect(info.scopes[0]!.label).toBe("(root)");
  });

  test("single project with package.json", () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", {
      name: "my-app",
      dependencies: { next: "^15.0.0" },
    });
    const info = buildWorkspaceInfo(dir);
    expect(info.isMonorepo).toBe(false);
    expect(info.scopes).toHaveLength(1);
    expect(info.scopes[0]!.types).toContain("web");
    expect(info.scopes[0]!.packageJson?.name).toBe("my-app");
  });

  test("monorepo with pnpm-workspace.yaml", () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", { name: "monorepo-root" });
    writeFileSync(join(dir, "pnpm-workspace.yaml"), `packages:\n  - "apps/*"\n  - "packages/*"\n`);

    // Create workspace dirs
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    writeJson(join(dir, "apps", "web"), "package.json", {
      name: "@repo/web",
      dependencies: { next: "^15.0.0" },
    });

    mkdirSync(join(dir, "packages", "ui"), { recursive: true });
    writeJson(join(dir, "packages", "ui"), "package.json", {
      name: "@repo/ui",
    });

    const info = buildWorkspaceInfo(dir);
    expect(info.isMonorepo).toBe(true);
    expect(info.scopes.length).toBeGreaterThanOrEqual(3); // root + 2 workspaces

    const root = info.scopes.find((s) => s.label === "(root)");
    expect(root).toBeDefined();

    const web = info.scopes.find((s) => s.label === "apps/web");
    expect(web).toBeDefined();
    expect(web?.types).toContain("web");

    const ui = info.scopes.find((s) => s.label === "packages/ui");
    expect(ui).toBeDefined();
  });

  test("monorepo workspace without package.json is skipped", () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", { name: "root" });
    writeFileSync(join(dir, "pnpm-workspace.yaml"), `packages:\n  - "apps/*"\n`);

    // Create dir without package.json
    mkdirSync(join(dir, "apps", "empty"), { recursive: true });

    const info = buildWorkspaceInfo(dir);
    expect(info.isMonorepo).toBe(true);
    // Only root scope, no workspace (empty has no package.json)
    expect(info.scopes).toHaveLength(1);
  });

  test("detects monorepo from package.json workspaces field", () => {
    const dir = makeTempDir();
    writeJson(dir, "package.json", {
      name: "root",
      workspaces: ["packages/*"],
    });

    mkdirSync(join(dir, "packages", "lib"), { recursive: true });
    writeJson(join(dir, "packages", "lib"), "package.json", {
      name: "@repo/lib",
    });

    const info = buildWorkspaceInfo(dir);
    expect(info.isMonorepo).toBe(true);
    expect(info.scopes.length).toBeGreaterThanOrEqual(2);
  });
});
