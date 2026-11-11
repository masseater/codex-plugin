import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), "test-structure-test-"));
}

function makeContext(rootDir: string): ProjectContext {
  return {
    rootDir,
    label: "apps/web",
    types: ["web"],
    packageJson: null,
  };
}

describe("meta", () => {
  test("has correct module metadata", () => {
    expect(meta.name).toBe("test-structure");
    expect(meta.scope).toBe("workspace");
    expect(meta.appliesTo).toEqual([]);
  });
});

describe("run", () => {
  test("clean project returns no findings", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "export const x = 1;\n");
    writeFileSync(join(dir, "src", "app.test.ts"), "// test\n");

    const findings = await run(makeContext(dir));
    expect(findings).toHaveLength(0);
  });

  test("__tests__/ directory produces a violation", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(dir, "src", "__tests__", "app.test.ts"), "// test\n");

    const findings = await run(makeContext(dir));
    const violations = findings.filter((f) => f.severity === "violation");
    expect(violations.length).toBeGreaterThanOrEqual(1);
    const first = violations[0];
    expect(first?.rule).toBe("test-structure");
    expect(first?.file).toContain("__tests__");
  });

  test("__test__/ directory (singular) produces a violation", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src", "__test__"), { recursive: true });
    writeFileSync(join(dir, "src", "__test__", "util.test.ts"), "// test\n");

    const findings = await run(makeContext(dir));
    const violations = findings.filter((f) => f.severity === "violation");
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.file).toContain("__test__");
  });

  test("multiple __tests__/ directories produce separate findings", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src", "__tests__"), { recursive: true });
    mkdirSync(join(dir, "lib", "__tests__"), { recursive: true });
    writeFileSync(join(dir, "src", "__tests__", "a.test.ts"), "// a\n");
    writeFileSync(join(dir, "lib", "__tests__", "b.test.ts"), "// b\n");

    const findings = await run(makeContext(dir));
    const violations = findings.filter((f) => f.severity === "violation");
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  test(".spec.ts file produces a warning", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.spec.ts"), "// spec\n");

    const findings = await run(makeContext(dir));
    const warnings = findings.filter((f) => f.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]?.rule).toBe("test-structure");
    expect(warnings[0]?.file).toContain("app.spec.ts");
  });

  test(".spec.tsx file produces a warning", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "Button.spec.tsx"), "// spec\n");

    const findings = await run(makeContext(dir));
    const warnings = findings.filter((f) => f.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]?.file).toContain("Button.spec.tsx");
  });

  test("node_modules __tests__/ directories are ignored", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "node_modules", "some-pkg", "__tests__"), {
      recursive: true,
    });
    writeFileSync(join(dir, "node_modules", "some-pkg", "__tests__", "x.ts"), "// x\n");

    const findings = await run(makeContext(dir));
    const violations = findings.filter((f) => f.severity === "violation");
    expect(violations).toHaveLength(0);
  });

  test("node_modules .spec.ts files are ignored", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "node_modules", "some-pkg", "src"), {
      recursive: true,
    });
    writeFileSync(join(dir, "node_modules", "some-pkg", "src", "index.spec.ts"), "// spec\n");

    const findings = await run(makeContext(dir));
    const warnings = findings.filter((f) => f.severity === "warning");
    expect(warnings).toHaveLength(0);
  });

  test("findings have correct field: line is null", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(dir, "src", "__tests__", "x.ts"), "// x\n");

    const findings = await run(makeContext(dir));
    for (const f of findings) {
      expect(f.line).toBeNull();
    }
  });
});
