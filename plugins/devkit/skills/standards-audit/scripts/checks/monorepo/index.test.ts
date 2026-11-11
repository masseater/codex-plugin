import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "monorepo-check-test-"));
}

function makeCtx(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    rootDir: "/test",
    label: "(root)",
    types: [],
    packageJson: null,
    ...overrides,
  };
}

describe("meta", () => {
  test("has correct name", () => {
    expect(meta.name).toBe("monorepo");
  });

  test("has scope all", () => {
    expect(meta.scope).toBe("all");
  });

  test("has empty appliesTo (applies to all types)", () => {
    expect(meta.appliesTo).toEqual([]);
  });

  test("has description", () => {
    expect(meta.description.length).toBeGreaterThan(0);
  });

  test("has references", () => {
    expect(meta.references.length).toBeGreaterThan(0);
  });
});

describe("monorepo/pnpm-workspace (root scope)", () => {
  test("no finding when pnpm-workspace.yaml exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    const ctx = makeCtx({ rootDir: dir, label: "(root)" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("pnpm-workspace.yaml"));
    expect(relevant).toHaveLength(0);
  });

  test("violation when pnpm-workspace.yaml is missing", async () => {
    const dir = makeTempDir();
    const ctx = makeCtx({ rootDir: dir, label: "(root)" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("pnpm-workspace.yaml"));
    expect(relevant).toHaveLength(1);
    expect(relevant[0]!.severity).toBe("violation");
    expect(relevant[0]!.rule).toBe("monorepo");
    expect(relevant[0]!.file).toBeNull();
    expect(relevant[0]!.line).toBeNull();
  });

  test("pnpm-workspace check only runs for root label", async () => {
    const dir = makeTempDir();
    // No pnpm-workspace.yaml, but label is workspace — should NOT produce the violation
    const ctx = makeCtx({ rootDir: dir, label: "apps/web" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("pnpm-workspace.yaml"));
    expect(relevant).toHaveLength(0);
  });
});

describe("monorepo/turbo-json (root scope)", () => {
  test("no finding when turbo.json exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    writeFileSync(join(dir, "turbo.json"), "{}");
    const ctx = makeCtx({ rootDir: dir, label: "(root)" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("turbo.json"));
    expect(relevant).toHaveLength(0);
  });

  test("warning when turbo.json is missing", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    const ctx = makeCtx({ rootDir: dir, label: "(root)" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("turbo.json"));
    expect(relevant).toHaveLength(1);
    expect(relevant[0]!.severity).toBe("warning");
    expect(relevant[0]!.rule).toBe("monorepo");
  });

  test("turbo.json check only runs for root label", async () => {
    const dir = makeTempDir();
    // No turbo.json, workspace label — should NOT produce the warning
    const ctx = makeCtx({ rootDir: dir, label: "packages/ui" });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("turbo.json"));
    expect(relevant).toHaveLength(0);
  });
});

describe("monorepo/workspace-protocol (workspace scope)", () => {
  test("no finding when all @repo/* deps use workspace: protocol", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        dependencies: {
          "@repo/ui": "workspace:*",
          "@repo/utils": "workspace:^",
          react: "^19.0.0",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("workspace:"));
    expect(relevant).toHaveLength(0);
  });

  test("violation when @repo/* dep does not use workspace: protocol", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        dependencies: {
          "@repo/ui": "^1.0.0",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("@repo/ui"));
    expect(relevant).toHaveLength(1);
    expect(relevant[0]!.severity).toBe("violation");
    expect(relevant[0]!.rule).toBe("monorepo");
  });

  test("violation when @repo/* dep in devDependencies does not use workspace: protocol", async () => {
    const ctx = makeCtx({
      label: "packages/lib",
      packageJson: {
        devDependencies: {
          "@repo/tsconfig": "1.0.0",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("@repo/tsconfig"));
    expect(relevant).toHaveLength(1);
    expect(relevant[0]!.severity).toBe("violation");
  });

  test("no finding when packageJson is null", async () => {
    const ctx = makeCtx({ label: "apps/web", packageJson: null });
    const findings = await run(ctx);
    const protocolFindings = findings.filter((f) => f.message.includes("workspace:"));
    expect(protocolFindings).toHaveLength(0);
  });

  test("no finding when no @repo/* deps present", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        dependencies: { react: "^19.0.0", next: "^15.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("workspace:"));
    expect(relevant).toHaveLength(0);
  });

  test("workspace-protocol check skips root label", async () => {
    const ctx = makeCtx({
      label: "(root)",
      packageJson: {
        dependencies: { "@repo/ui": "^1.0.0" },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.message.includes("@repo/ui"));
    expect(relevant).toHaveLength(0);
  });

  test("multiple violations reported individually", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        dependencies: {
          "@repo/ui": "^1.0.0",
          "@repo/utils": "1.2.3",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter(
      (f) => f.message.includes("@repo/ui") || f.message.includes("@repo/utils"),
    );
    expect(relevant).toHaveLength(2);
  });
});

describe("monorepo/workspace-scripts (workspace scope)", () => {
  test("no finding when check and typecheck scripts exist", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        scripts: {
          check: "biome check",
          typecheck: "tsc --noEmit",
          build: "next build",
        },
      },
    });
    const findings = await run(ctx);
    const _relevant = findings.filter(
      (f) => f.message.includes("check") || f.message.includes("typecheck"),
    );
    // No missing-script warnings
    const missingScriptFindings = findings.filter(
      (f) => f.message.includes("missing") || f.message.includes("script"),
    );
    expect(missingScriptFindings).toHaveLength(0);
  });

  test("warning when check script is missing", async () => {
    const ctx = makeCtx({
      label: "apps/web",
      packageJson: {
        scripts: {
          typecheck: "tsc --noEmit",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter(
      (f) => f.severity === "warning" && f.message.includes("check"),
    );
    expect(relevant.length).toBeGreaterThanOrEqual(1);
    expect(relevant[0]!.rule).toBe("monorepo");
  });

  test("warning when typecheck script is missing", async () => {
    const ctx = makeCtx({
      label: "packages/ui",
      packageJson: {
        scripts: {
          check: "biome check",
        },
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter(
      (f) => f.severity === "warning" && f.message.includes("typecheck"),
    );
    expect(relevant.length).toBeGreaterThanOrEqual(1);
  });

  test("two warnings when both scripts are missing", async () => {
    const ctx = makeCtx({
      label: "packages/ui",
      packageJson: {
        scripts: {},
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter((f) => f.severity === "warning");
    expect(relevant.length).toBeGreaterThanOrEqual(2);
  });

  test("no finding when packageJson is null", async () => {
    const ctx = makeCtx({ label: "apps/web", packageJson: null });
    const findings = await run(ctx);
    expect(findings).toHaveLength(0);
  });

  test("workspace-scripts check skips root label", async () => {
    const ctx = makeCtx({
      label: "(root)",
      packageJson: {
        scripts: {},
      },
    });
    const findings = await run(ctx);
    const relevant = findings.filter(
      (f) =>
        f.severity === "warning" &&
        (f.message.includes("check") || f.message.includes("typecheck")),
    );
    expect(relevant).toHaveLength(0);
  });
});
