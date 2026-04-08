import { describe, expect, test } from "bun:test";
import { formatReport } from "./format.ts";
import type { Finding, ProjectContext, WorkspaceInfo } from "./types.ts";

function makeScope(overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    rootDir: "/test/project",
    label: "(root)",
    types: [],
    packageJson: null,
    ...overrides,
  };
}

function makeWorkspace(overrides?: Partial<WorkspaceInfo>): WorkspaceInfo {
  return {
    rootDir: "/test/project",
    isMonorepo: false,
    scopes: [makeScope()],
    ...overrides,
  };
}

function makeFinding(overrides?: Partial<Finding>): Finding {
  return {
    severity: "violation",
    rule: "test-check",
    file: null,
    line: null,
    message: "Something is wrong — fix it",
    ...overrides,
  };
}

describe("formatReport", () => {
  test("no findings returns pass message", () => {
    const result = formatReport({
      workspace: makeWorkspace(),
      scopeResults: [{ scope: makeScope(), findings: [] }],
    });
    expect(result).toContain("All checks passed");
  });

  test("single project with violations", () => {
    const result = formatReport({
      workspace: makeWorkspace({ scopes: [makeScope({ types: ["web"] })] }),
      scopeResults: [
        {
          scope: makeScope({ types: ["web"] }),
          findings: [
            makeFinding({
              severity: "violation",
              rule: "scripts",
              message: 'Missing "check" script',
            }),
          ],
        },
      ],
    });
    expect(result).toContain("### Violations");
    expect(result).toContain("[scripts]");
    expect(result).toContain('Missing "check" script');
    expect(result).toContain("1 violations");
  });

  test("single project with warnings", () => {
    const result = formatReport({
      workspace: makeWorkspace(),
      scopeResults: [
        {
          scope: makeScope(),
          findings: [
            makeFinding({
              severity: "warning",
              rule: "config-files",
              message: "git hook config not found",
            }),
          ],
        },
      ],
    });
    expect(result).toContain("### Warnings");
    expect(result).toContain("[config-files]");
  });

  test("file location formatting", () => {
    const result = formatReport({
      workspace: makeWorkspace(),
      scopeResults: [
        {
          scope: makeScope(),
          findings: [
            makeFinding({ file: "src/env.ts", line: 5 }),
            makeFinding({ file: "package.json", line: null }),
            makeFinding({ file: null, line: null }),
          ],
        },
      ],
    });
    expect(result).toContain("`src/env.ts:5`");
    expect(result).toContain("`package.json`");
    expect(result).toContain("(project-level)");
  });

  test("monorepo format with multiple scopes", () => {
    const rootScope = makeScope({ label: "(root)" });
    const webScope = makeScope({ label: "apps/web", types: ["web"] });
    const result = formatReport({
      workspace: makeWorkspace({
        isMonorepo: true,
        scopes: [rootScope, webScope],
      }),
      scopeResults: [
        {
          scope: rootScope,
          findings: [makeFinding({ rule: "ci", message: "Missing CI" })],
        },
        {
          scope: webScope,
          findings: [
            makeFinding({
              severity: "warning",
              rule: "scripts",
              message: "Missing test:coverage",
            }),
          ],
        },
      ],
    });
    expect(result).toContain("Type: monorepo");
    expect(result).toContain("### (root)");
    expect(result).toContain("### apps/web (web)");
    expect(result).toContain("across 2 scopes");
  });

  test("findings are sorted by file then line", () => {
    const result = formatReport({
      workspace: makeWorkspace(),
      scopeResults: [
        {
          scope: makeScope(),
          findings: [
            makeFinding({ file: "z.ts", line: 1, message: "z-first" }),
            makeFinding({ file: "a.ts", line: 10, message: "a-tenth" }),
            makeFinding({ file: "a.ts", line: 2, message: "a-second" }),
          ],
        },
      ],
    });
    const aSecond = result.indexOf("a-second");
    const aTenth = result.indexOf("a-tenth");
    const zFirst = result.indexOf("z-first");
    expect(aSecond).toBeLessThan(aTenth);
    expect(aTenth).toBeLessThan(zFirst);
  });

  test("empty sections are omitted", () => {
    const result = formatReport({
      workspace: makeWorkspace(),
      scopeResults: [
        {
          scope: makeScope(),
          findings: [makeFinding({ severity: "warning" })],
        },
      ],
    });
    expect(result).not.toContain("### Violations");
    expect(result).toContain("### Warnings");
  });
});
