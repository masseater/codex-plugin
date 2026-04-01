import { describe, expect, test } from "bun:test";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeCtx(devDependencies: Record<string, string> = {}): ProjectContext {
  return {
    rootDir: "/test",
    label: "(root)",
    types: [],
    packageJson: { devDependencies },
  };
}

describe("meta", () => {
  test("has expected shape", () => {
    expect(meta.name).toBe("quality-libs");
    expect(meta.scope).toBe("root");
    expect(Array.isArray(meta.appliesTo)).toBe(true);
    expect(Array.isArray(meta.references)).toBe(true);
  });
});

describe("quality/linter", () => {
  test("no finding when oxlint is present", async () => {
    const findings = await run(makeCtx({ oxlint: "^0.16.0" }));
    const linter = findings.filter(
      (f) => f.rule === "quality-libs" && f.message.includes("linter"),
    );
    expect(linter).toHaveLength(0);
  });

  test("no finding when @biomejs/biome is present", async () => {
    const findings = await run(makeCtx({ "@biomejs/biome": "^2.0.0" }));
    const linter = findings.filter(
      (f) =>
        f.message.toLowerCase().includes("linter") ||
        f.message.toLowerCase().includes("oxlint") ||
        f.message.toLowerCase().includes("biome"),
    );
    expect(linter).toHaveLength(0);
  });

  test("warning when neither oxlint nor @biomejs/biome is present", async () => {
    const findings = await run(makeCtx({ typescript: "^5.0.0" }));
    const linter = findings.find(
      (f) =>
        f.rule === "quality-libs" &&
        f.severity === "warning" &&
        (f.message.includes("oxlint") || f.message.includes("biome")),
    );
    expect(linter).toBeDefined();
    expect(linter?.file).toBeNull();
    expect(linter?.line).toBeNull();
  });

  test("warning when packageJson is null", async () => {
    const ctx: ProjectContext = {
      rootDir: "/test",
      label: "(root)",
      types: [],
      packageJson: null,
    };
    const findings = await run(ctx);
    const linter = findings.find(
      (f) =>
        f.rule === "quality-libs" &&
        f.severity === "warning" &&
        (f.message.includes("oxlint") || f.message.includes("biome")),
    );
    expect(linter).toBeDefined();
  });
});

describe("quality/tsgo", () => {
  test("no finding when @typescript/native-preview is present", async () => {
    const findings = await run(makeCtx({ "@typescript/native-preview": "^7.0.0" }));
    const tsgo = findings.find((f) => f.message.includes("@typescript/native-preview"));
    expect(tsgo).toBeUndefined();
  });

  test("warning when @typescript/native-preview is absent", async () => {
    const findings = await run(makeCtx({ typescript: "^5.0.0" }));
    const tsgo = findings.find(
      (f) =>
        f.rule === "quality-libs" &&
        f.severity === "warning" &&
        f.message.includes("@typescript/native-preview"),
    );
    expect(tsgo).toBeDefined();
    expect(tsgo?.file).toBeNull();
    expect(tsgo?.line).toBeNull();
  });
});

describe("quality/vitest", () => {
  test("no finding when vitest is present", async () => {
    const findings = await run(makeCtx({ vitest: "^3.0.0" }));
    const v = findings.find((f) => f.message.includes("vitest"));
    expect(v).toBeUndefined();
  });

  test("warning when vitest is absent", async () => {
    const findings = await run(makeCtx({}));
    const v = findings.find(
      (f) => f.rule === "quality-libs" && f.severity === "warning" && f.message.includes("vitest"),
    );
    expect(v).toBeDefined();
    expect(v?.file).toBeNull();
    expect(v?.line).toBeNull();
  });
});

describe("quality/knip", () => {
  test("no finding when knip is present", async () => {
    const findings = await run(makeCtx({ knip: "^5.0.0" }));
    const k = findings.find((f) => f.message.includes("knip"));
    expect(k).toBeUndefined();
  });

  test("warning when knip is absent", async () => {
    const findings = await run(makeCtx({}));
    const k = findings.find(
      (f) => f.rule === "quality-libs" && f.severity === "warning" && f.message.includes("knip"),
    );
    expect(k).toBeDefined();
    expect(k?.file).toBeNull();
    expect(k?.line).toBeNull();
  });
});

describe("quality/eslint-oxlint", () => {
  test("no finding when only oxlint (no eslint)", async () => {
    const findings = await run(makeCtx({ oxlint: "^0.16.0" }));
    const e = findings.find((f) => f.message.includes("eslint-plugin-oxlint"));
    expect(e).toBeUndefined();
  });

  test("no finding when only eslint (no oxlint)", async () => {
    const findings = await run(makeCtx({ eslint: "^9.0.0" }));
    const e = findings.find((f) => f.message.includes("eslint-plugin-oxlint"));
    expect(e).toBeUndefined();
  });

  test("no finding when both oxlint and eslint and eslint-plugin-oxlint present", async () => {
    const findings = await run(
      makeCtx({
        oxlint: "^0.16.0",
        eslint: "^9.0.0",
        "eslint-plugin-oxlint": "^0.1.0",
      }),
    );
    const e = findings.find((f) => f.message.includes("eslint-plugin-oxlint"));
    expect(e).toBeUndefined();
  });

  test("violation when both oxlint and eslint present but eslint-plugin-oxlint missing", async () => {
    const findings = await run(makeCtx({ oxlint: "^0.16.0", eslint: "^9.0.0" }));
    const e = findings.find(
      (f) =>
        f.rule === "quality-libs" &&
        f.severity === "violation" &&
        f.message.includes("eslint-plugin-oxlint"),
    );
    expect(e).toBeDefined();
    expect(e?.file).toBeNull();
    expect(e?.line).toBeNull();
  });
});

describe("all checks pass with full devDependencies", () => {
  test("no findings when all required packages are present", async () => {
    const findings = await run(
      makeCtx({
        oxlint: "^0.16.0",
        "@typescript/native-preview": "^7.0.0",
        vitest: "^3.0.0",
        knip: "^5.0.0",
      }),
    );
    // Only the eslint-oxlint check can produce a violation; linter/tsgo/vitest/knip all pass
    const nonEslintOxlint = findings.filter((f) => !f.message.includes("eslint-plugin-oxlint"));
    expect(nonEslintOxlint).toHaveLength(0);
  });
});
