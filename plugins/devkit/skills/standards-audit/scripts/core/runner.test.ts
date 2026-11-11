import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverChecks, runChecksForScope } from "./runner.ts";
import type { CheckMeta, Finding, ProjectContext, ProjectType } from "./types.ts";

function makeTempChecksDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "runner-test-"));
  return dir;
}

function makeScope(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    rootDir: "/test",
    label: "(root)",
    types: [],
    packageJson: null,
    ...overrides,
  };
}

function writeCheckModule(
  checksDir: string,
  name: string,
  meta: CheckMeta,
  findings: Finding[],
): void {
  const dir = join(checksDir, name);
  mkdirSync(dir, { recursive: true });
  const metaJson = JSON.stringify(meta);
  const findingsJson = JSON.stringify(findings);
  writeFileSync(
    join(dir, "index.ts"),
    `export const meta = ${metaJson};
export async function run() { return ${findingsJson}; }
`,
  );
}

describe("discoverChecks", () => {
  test("discovers check modules from directory", async () => {
    const dir = makeTempChecksDir();
    writeCheckModule(
      dir,
      "test-check",
      {
        name: "test-check",
        description: "A test check",
        references: ["test.md"],
        appliesTo: [],
        scope: "all",
      },
      [],
    );

    const checks = await discoverChecks(dir);
    expect(checks.size).toBe(1);
    expect(checks.has("test-check")).toBe(true);
  });

  test("discovers multiple check modules", async () => {
    const dir = makeTempChecksDir();
    writeCheckModule(
      dir,
      "check-a",
      {
        name: "check-a",
        description: "",
        references: [],
        appliesTo: [],
        scope: "all",
      },
      [],
    );
    writeCheckModule(
      dir,
      "check-b",
      {
        name: "check-b",
        description: "",
        references: [],
        appliesTo: [],
        scope: "all",
      },
      [],
    );

    const checks = await discoverChecks(dir);
    expect(checks.size).toBe(2);
  });

  test("skips directories without index.ts", async () => {
    const dir = makeTempChecksDir();
    mkdirSync(join(dir, "empty-dir"), { recursive: true });
    writeCheckModule(
      dir,
      "valid",
      {
        name: "valid",
        description: "",
        references: [],
        appliesTo: [],
        scope: "all",
      },
      [],
    );

    const checks = await discoverChecks(dir);
    expect(checks.size).toBe(1);
    expect(checks.has("valid")).toBe(true);
  });
});

describe("runChecksForScope", () => {
  test("runs checks and collects findings", async () => {
    const findings: Finding[] = [
      {
        severity: "violation",
        rule: "my-check",
        file: null,
        line: null,
        message: "Bad thing found",
      },
    ];
    const checks = new Map([
      [
        "my-check",
        {
          meta: {
            name: "my-check",
            description: "",
            references: [],
            appliesTo: [] as ProjectType[],
            scope: "all" as const,
          },
          run: async () => findings,
        },
      ],
    ]);

    const result = await runChecksForScope(makeScope(), checks, false);
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("Bad thing found");
  });

  test("filters by appliesTo", async () => {
    const checks = new Map([
      [
        "web-only",
        {
          meta: {
            name: "web-only",
            description: "",
            references: [],
            appliesTo: ["web"] as ProjectType[],
            scope: "all" as const,
          },
          run: async () => [
            {
              severity: "warning" as const,
              rule: "web-only",
              file: null,
              line: null,
              message: "web issue",
            },
          ],
        },
      ],
    ]);

    // CLI project should skip web-only check
    const result = await runChecksForScope(makeScope({ types: ["cli"] }), checks, false);
    expect(result).toHaveLength(0);
  });

  test("appliesTo empty means all types", async () => {
    const checks = new Map([
      [
        "universal",
        {
          meta: {
            name: "universal",
            description: "",
            references: [],
            appliesTo: [] as ProjectType[],
            scope: "all" as const,
          },
          run: async () => [
            {
              severity: "warning" as const,
              rule: "universal",
              file: null,
              line: null,
              message: "found",
            },
          ],
        },
      ],
    ]);

    const result = await runChecksForScope(makeScope({ types: ["cli"] }), checks, false);
    expect(result).toHaveLength(1);
  });

  test("filters by scope: root-only checks skip workspaces", async () => {
    const checks = new Map([
      [
        "root-check",
        {
          meta: {
            name: "root-check",
            description: "",
            references: [],
            appliesTo: [] as ProjectType[],
            scope: "root" as const,
          },
          run: async () => [
            {
              severity: "warning" as const,
              rule: "root-check",
              file: null,
              line: null,
              message: "root issue",
            },
          ],
        },
      ],
    ]);

    // isRoot=false should skip root-only checks
    const result = await runChecksForScope(makeScope({ label: "apps/web" }), checks, false);
    expect(result).toHaveLength(0);

    // isRoot=true should run root-only checks
    const rootResult = await runChecksForScope(makeScope({ label: "(root)" }), checks, true);
    expect(rootResult).toHaveLength(1);
  });

  test("converts check exceptions to warning findings", async () => {
    const checks = new Map([
      [
        "broken",
        {
          meta: {
            name: "broken",
            description: "",
            references: [],
            appliesTo: [] as ProjectType[],
            scope: "all" as const,
          },
          run: async () => {
            throw new Error("Something went wrong");
          },
        },
      ],
    ]);

    const result = await runChecksForScope(makeScope(), checks, false);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("warning");
    expect(result[0]!.message).toContain("Something went wrong");
  });
});
