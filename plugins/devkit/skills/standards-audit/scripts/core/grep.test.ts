import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { grepProject } from "./grep.ts";

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "grep-test-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

describe("grepProject", () => {
  test("finds matches in source files", async () => {
    const dir = makeTempProject();
    writeFileSync(join(dir, "src", "bad.ts"), "const url = process.env.DATABASE_URL;\n");
    writeFileSync(join(dir, "src", "good.ts"), 'import { env } from "./env";\n');

    const matches = await grepProject(dir, "process\\.env\\.", "src/**/*.ts");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.file).toContain("bad.ts");
    expect(matches[0]!.line).toBe(1);
  });

  test("excludes node_modules by default", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "pkg", "index.ts"), "process.env.FOO;\n");
    writeFileSync(join(dir, "src", "ok.ts"), "const x = 1;\n");

    const matches = await grepProject(dir, "process\\.env\\.", "**/*.ts");
    const nodeModuleMatch = matches.find((m) => m.file.includes("node_modules"));
    expect(nodeModuleMatch).toBeUndefined();
  });

  test("respects additional exclude patterns", async () => {
    const dir = makeTempProject();
    writeFileSync(join(dir, "src", "env.ts"), "process.env.FOO;\n");
    writeFileSync(join(dir, "src", "app.ts"), "process.env.BAR;\n");

    const matches = await grepProject(dir, "process\\.env\\.", "src/**/*.ts", ["**/env.ts"]);
    const envMatch = matches.find((m) => m.file.endsWith("env.ts"));
    expect(envMatch).toBeUndefined();
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test("returns empty array for no matches", async () => {
    const dir = makeTempProject();
    writeFileSync(join(dir, "src", "clean.ts"), "const x = 1;\n");

    const matches = await grepProject(dir, "skipEnvValidation", "src/**/*.ts");
    expect(matches).toEqual([]);
  });
});
