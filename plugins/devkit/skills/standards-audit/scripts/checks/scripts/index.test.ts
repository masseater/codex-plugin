import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "scripts-check-test-"));
}

function makeCtx(
  overrides?: Partial<ProjectContext> & {
    scripts?: Record<string, string>;
  },
): ProjectContext {
  const { scripts, ...rest } = overrides ?? {};
  return {
    rootDir: "/test",
    label: "(root)",
    types: [],
    packageJson: scripts !== undefined ? { scripts } : null,
    ...rest,
  };
}

describe("meta", () => {
  test("has required fields", () => {
    expect(meta.name).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.references.length).toBeGreaterThan(0);
    expect(meta.scope).toBe("all");
    expect(meta.appliesTo).toEqual([]);
  });
});

describe("run — null packageJson", () => {
  test("returns empty findings when packageJson is null", async () => {
    const findings = await run(makeCtx({ packageJson: null }));
    expect(findings).toHaveLength(0);
  });
});

describe("run — scripts/check", () => {
  test("violation when check script is missing", async () => {
    const findings = await run(makeCtx({ scripts: {} }));
    const f = findings.find((f) => f.rule === "scripts" && f.message.includes("check"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("violation");
  });

  test("no finding when check script is present", async () => {
    const findings = await run(makeCtx({ scripts: { check: "biome check" } }));
    const violations = findings.filter(
      (f) => f.severity === "violation" && f.message.toLowerCase().includes('"check"'),
    );
    expect(violations).toHaveLength(0);
  });
});

describe("run — scripts/typecheck", () => {
  test("violation when typecheck script is missing", async () => {
    const findings = await run(makeCtx({ scripts: {} }));
    const f = findings.find((f) => f.rule === "scripts" && f.message.includes("typecheck"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("violation");
  });

  test("no finding when typecheck script is present and uses tsgo", async () => {
    const findings = await run(
      makeCtx({
        scripts: { check: "biome check", typecheck: "tsgo --noEmit" },
      }),
    );
    const typecheckFindings = findings.filter((f) => f.message.includes("typecheck"));
    expect(typecheckFindings).toHaveLength(0);
  });
});

describe("run — scripts/typecheck-tsgo", () => {
  test("violation when typecheck script uses tsc instead of tsgo", async () => {
    const findings = await run(makeCtx({ scripts: { typecheck: "tsc --noEmit" } }));
    const f = findings.find((f) => f.rule === "scripts" && f.message.includes("tsgo"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("violation");
  });

  test("no violation when typecheck uses tsgo", async () => {
    const findings = await run(makeCtx({ scripts: { typecheck: "tsgo --noEmit" } }));
    const f = findings.find((f) => f.message.includes("tsgo"));
    expect(f).toBeUndefined();
  });

  test("no tsgo-vs-tsc violation when typecheck script is absent", async () => {
    // Only the "typecheck missing" violation fires, not the "must use tsgo" one
    const findings = await run(makeCtx({ scripts: {} }));
    // The tsgo-vs-tsc finding specifically calls out the current value of the script
    const f = findings.find(
      (f) => f.message.includes("tsgo") && f.message.includes("Current value:"),
    );
    expect(f).toBeUndefined();
  });
});

describe("run — scripts/test-coverage (conditional on *.test.ts files)", () => {
  test("warning when test:coverage missing and test files exist", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "foo.test.ts"), "// test");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: {} },
    });
    const f = findings.find((f) => f.rule === "scripts" && f.message.includes("test:coverage"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warning");
  });

  test("no warning when test:coverage missing but no test files exist", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: {} },
    });
    const f = findings.find((f) => f.message.includes("test:coverage"));
    expect(f).toBeUndefined();
  });

  test("no warning when test:coverage is present even with test files", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "bar.test.ts"), "// test");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: { "test:coverage": "bun test --coverage" } },
    });
    const f = findings.find((f) => f.message.includes("test:coverage"));
    expect(f).toBeUndefined();
  });

  test("detects test files in subdirectories", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "src", "utils"), { recursive: true });
    writeFileSync(join(dir, "src", "utils", "helpers.test.ts"), "// test");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: {} },
    });
    const f = findings.find((f) => f.message.includes("test:coverage"));
    expect(f).toBeDefined();
  });
});

describe("run — scripts/knip (conditional on src/ dir)", () => {
  test("warning when knip missing and src/ dir exists", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "src"), { recursive: true });
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: {} },
    });
    const f = findings.find((f) => f.rule === "scripts" && f.message.includes("knip"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warning");
  });

  test("no warning when knip missing and no src/ dir", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: {} },
    });
    const f = findings.find((f) => f.message.includes("knip"));
    expect(f).toBeUndefined();
  });

  test("no warning when knip script present and src/ dir exists", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "src"), { recursive: true });
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: { scripts: { knip: "knip" } },
    });
    const f = findings.find((f) => f.message.includes("knip"));
    expect(f).toBeUndefined();
  });
});

describe("run — file and line fields", () => {
  test("all findings have file=null and line=null", async () => {
    const findings = await run(makeCtx({ scripts: {} }));
    for (const f of findings) {
      expect(f.file).toBeNull();
      expect(f.line).toBeNull();
    }
  });

  test("all findings use rule='scripts'", async () => {
    const findings = await run(makeCtx({ scripts: {} }));
    for (const f of findings) {
      expect(f.rule).toBe("scripts");
    }
  });
});
