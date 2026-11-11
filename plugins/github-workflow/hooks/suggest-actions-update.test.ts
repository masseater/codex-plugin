import { afterEach, describe, expect, test, vi } from "vitest";

const { capturedHookDefs, mockReadFileSync } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: Record<string, unknown>) => unknown }[],
  mockReadFileSync: vi.fn<(...args: unknown[]) => string>(),
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));

vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((def: { run: (ctx: Record<string, unknown>) => unknown }) => {
    capturedHookDefs.push(def);
    return def;
  }),
  runHook: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

import "./entry/suggest-actions-update.ts";
import {
  collectUsesValues,
  extractActionRefs,
  fetchLatestMajorVersion,
  findOutdatedActions,
  formatSuggestions,
  isGitHubWorkflowFile,
  parseActionRef,
  parseMajorVersion,
  pickMaxMajorVersion,
} from "./lib/actions-versions.ts";

describe("isGitHubWorkflowFile", () => {
  test("matches .github workflow yml files", () => {
    expect(isGitHubWorkflowFile("/repo/.github/workflows/ci.yml")).toBe(true);
    expect(isGitHubWorkflowFile("/repo/.github/workflows/deploy.yaml")).toBe(true);
    expect(isGitHubWorkflowFile(".github/actions/my-action/action.yml")).toBe(true);
  });

  test("rejects non-workflow files", () => {
    expect(isGitHubWorkflowFile("/repo/src/config.yml")).toBe(false);
    expect(isGitHubWorkflowFile("/repo/.github/CODEOWNERS")).toBe(false);
    expect(isGitHubWorkflowFile("/repo/docker-compose.yml")).toBe(false);
  });
});

describe("parseMajorVersion", () => {
  test("parses v-prefixed versions", () => {
    expect(parseMajorVersion("v4")).toBe(4);
    expect(parseMajorVersion("v3")).toBe(3);
    expect(parseMajorVersion("v12")).toBe(12);
  });

  test("parses versions with minor/patch", () => {
    expect(parseMajorVersion("v3.5.2")).toBe(3);
    expect(parseMajorVersion("v4.0.0")).toBe(4);
  });

  test("returns null for invalid versions", () => {
    expect(parseMajorVersion("main")).toBeNull();
    expect(parseMajorVersion("abc123")).toBeNull();
  });
});

describe("parseActionRef", () => {
  test("parses standard action reference", () => {
    expect(parseActionRef("actions/checkout@v3")).toStrictEqual({
      path: "actions/checkout",
      repo: "actions/checkout",
      current: "v3",
    });
  });

  test("parses sub-path action reference", () => {
    expect(parseActionRef("actions/cache/restore@v3")).toStrictEqual({
      path: "actions/cache/restore",
      repo: "actions/cache",
      current: "v3",
    });
  });

  test("parses version with minor/patch", () => {
    expect(parseActionRef("actions/checkout@v3.5.2")).toStrictEqual({
      path: "actions/checkout",
      repo: "actions/checkout",
      current: "v3.5.2",
    });
  });

  test("returns null for SHA references", () => {
    expect(parseActionRef("actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29")).toBeNull();
  });

  test("returns null for branch references", () => {
    expect(parseActionRef("actions/checkout@main")).toBeNull();
  });

  test("returns null for local actions", () => {
    expect(parseActionRef("./my-action")).toBeNull();
  });
});

describe("collectUsesValues", () => {
  test("collects uses from nested workflow structure", () => {
    const doc = {
      jobs: {
        build: {
          steps: [
            { uses: "actions/checkout@v3" },
            { run: "npm test" },
            { uses: "actions/setup-node@v4" },
          ],
        },
      },
    };
    expect(collectUsesValues(doc)).toStrictEqual(["actions/checkout@v3", "actions/setup-node@v4"]);
  });

  test("collects from multiple jobs", () => {
    const doc = {
      jobs: {
        lint: { steps: [{ uses: "actions/checkout@v3" }] },
        test: { steps: [{ uses: "actions/checkout@v3" }, { uses: "codecov/codecov-action@v4" }] },
      },
    };
    expect(collectUsesValues(doc)).toStrictEqual([
      "actions/checkout@v3",
      "actions/checkout@v3",
      "codecov/codecov-action@v4",
    ]);
  });

  test("returns empty for null/undefined", () => {
    expect(collectUsesValues(null)).toStrictEqual([]);
    expect(collectUsesValues(undefined)).toStrictEqual([]);
  });
});

describe("extractActionRefs", () => {
  const workflow = (steps: string) =>
    ["jobs:", "  build:", "    runs-on: ubuntu-latest", "    steps:", steps].join("\n");

  test("extracts action refs with repo derived from path", () => {
    const content = workflow(
      ["      - uses: actions/checkout@v3", "      - uses: docker/build-push-action@v5"].join("\n"),
    );

    const refs = extractActionRefs(content);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toStrictEqual({
      path: "actions/checkout",
      repo: "actions/checkout",
      current: "v3",
    });
    expect(refs[1]).toStrictEqual({
      path: "docker/build-push-action",
      repo: "docker/build-push-action",
      current: "v5",
    });
  });

  test("handles sub-path actions (actions/cache/restore)", () => {
    const content = workflow("      - uses: actions/cache/restore@v3");
    const refs = extractActionRefs(content);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toStrictEqual({
      path: "actions/cache/restore",
      repo: "actions/cache",
      current: "v3",
    });
  });

  test("deduplicates same action@version", () => {
    const content = workflow(
      ["      - uses: actions/checkout@v3", "      - uses: actions/checkout@v3"].join("\n"),
    );
    expect(extractActionRefs(content)).toHaveLength(1);
  });

  test("keeps different versions of same action", () => {
    const content = workflow(
      ["      - uses: actions/checkout@v3", "      - uses: actions/checkout@v4"].join("\n"),
    );
    expect(extractActionRefs(content)).toHaveLength(2);
  });

  test("ignores commented-out uses (YAML parser skips comments)", () => {
    const content = workflow(
      ["      # - uses: actions/checkout@v2", "      - uses: actions/checkout@v6"].join("\n"),
    );
    const refs = extractActionRefs(content);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.current).toBe("v6");
  });

  test("ignores SHA references", () => {
    const content = workflow(
      "      - uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29",
    );
    expect(extractActionRefs(content)).toHaveLength(0);
  });

  test("ignores branch references", () => {
    const content = workflow("      - uses: actions/checkout@main");
    expect(extractActionRefs(content)).toHaveLength(0);
  });

  test("returns empty for invalid YAML", () => {
    expect(extractActionRefs("not: [valid: yaml: {{")).toStrictEqual([]);
  });
});

describe("pickMaxMajorVersion", () => {
  test("picks highest major version from tags", () => {
    expect(pickMaxMajorVersion(["v6.0.2", "v6", "v5.0.0", "v5", "v4"])).toBe("v6");
  });

  test("handles single tag", () => {
    expect(pickMaxMajorVersion(["v3"])).toBe("v3");
  });

  test("returns null for empty list", () => {
    expect(pickMaxMajorVersion([])).toBeNull();
  });

  test("returns null for non-version tags only", () => {
    expect(pickMaxMajorVersion(["latest", "main", "nightly"])).toBeNull();
  });

  test("ignores non-version tags mixed in", () => {
    expect(pickMaxMajorVersion(["latest", "v2", "nightly", "v1"])).toBe("v2");
  });
});

describe("formatSuggestions", () => {
  test("formats outdated actions as readable message", () => {
    const result = formatSuggestions([
      { name: "actions/checkout", current: "v3", latest: "v6" },
      { name: "my-org/my-action", current: "v1", latest: "v3" },
    ]);

    expect(result).toContain("[GitHub Actions Update]");
    expect(result).toContain("actions/checkout: v3 → v6");
    expect(result).toContain("my-org/my-action: v1 → v3");
  });
});

describe("fetchLatestMajorVersion", () => {
  const originalSpawn = globalThis.Bun?.spawn;

  function mockBunSpawn(stdout: string) {
    const mockSpawn = vi.fn(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([stdout]).stream(),
      stderr: new Blob([""]).stream(),
    }));
    if (!globalThis.Bun) {
      (globalThis as Record<string, unknown>).Bun = {};
    }
    (globalThis.Bun as Record<string, unknown>).spawn = mockSpawn;
    return mockSpawn;
  }

  afterEach(() => {
    if (originalSpawn) {
      (globalThis.Bun as Record<string, unknown>).spawn = originalSpawn;
    }
  });

  test("returns latest major version from tags", async () => {
    mockBunSpawn("v6.0.2\nv6\nv5.0.0\nv5\nv4\n");
    const result = await fetchLatestMajorVersion("actions/checkout");
    expect(result).toBe("v6");
  });

  test("returns null when no tags found", async () => {
    mockBunSpawn("");
    const result = await fetchLatestMajorVersion("unknown/repo");
    expect(result).toBeNull();
  });

  test("returns null when tags have no version format", async () => {
    mockBunSpawn("latest\nmain\nnightly\n");
    const result = await fetchLatestMajorVersion("some/repo");
    expect(result).toBeNull();
  });
});

describe("findOutdatedActions", () => {
  const originalSpawn = globalThis.Bun?.spawn;

  function mockBunSpawnByRepo(repoTags: Record<string, string>) {
    const mockSpawn = vi.fn((cmdArgs: string[]) => {
      const apiUrl = cmdArgs[2] ?? "";
      let stdout = "";
      for (const [repo, tags] of Object.entries(repoTags)) {
        if (apiUrl.includes(`repos/${repo}/`)) {
          stdout = tags;
          break;
        }
      }
      return {
        exited: Promise.resolve(0),
        stdout: new Blob([stdout]).stream(),
        stderr: new Blob([""]).stream(),
      };
    });
    if (!globalThis.Bun) {
      (globalThis as Record<string, unknown>).Bun = {};
    }
    (globalThis.Bun as Record<string, unknown>).spawn = mockSpawn;
    return mockSpawn;
  }

  afterEach(() => {
    if (originalSpawn) {
      (globalThis.Bun as Record<string, unknown>).spawn = originalSpawn;
    }
  });

  test("returns outdated actions by comparing with fetched tags", async () => {
    mockBunSpawnByRepo({
      "actions/checkout": "v6.0.2\nv6\nv5\nv4\n",
      "actions/setup-node": "v6\nv5\nv4\n",
    });

    const refs = [
      { path: "actions/checkout", repo: "actions/checkout", current: "v3" },
      { path: "actions/setup-node", repo: "actions/setup-node", current: "v6" },
    ];

    const outdated = await findOutdatedActions(refs);
    expect(outdated).toHaveLength(1);
    expect(outdated[0]).toStrictEqual({ name: "actions/checkout", current: "v3", latest: "v6" });
  });

  test("deduplicates API calls for same repo (sub-path actions)", async () => {
    const mockSpawn = mockBunSpawnByRepo({
      "actions/cache": "v5\nv4\nv3\n",
    });

    const refs = [
      { path: "actions/cache/save", repo: "actions/cache", current: "v3" },
      { path: "actions/cache/restore", repo: "actions/cache", current: "v3" },
    ];

    const outdated = await findOutdatedActions(refs);
    expect(outdated).toHaveLength(2);
    // Only 1 API call for the shared repo
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  test("skips actions whose repo cannot be resolved", async () => {
    mockBunSpawnByRepo({});

    const refs = [{ path: "unknown/action", repo: "unknown/action", current: "v1" }];
    const outdated = await findOutdatedActions(refs);
    expect(outdated).toHaveLength(0);
  });
});

describe("suggest-actions-update hook", () => {
  function createMockContext(filePath: string) {
    const successResult = { type: "success" };
    const deferResult = { type: "defer" };
    return {
      input: { tool_input: { file_path: filePath } },
      success: vi.fn(() => successResult),
      defer: vi.fn(() => deferResult),
    };
  }

  function getHookRun() {
    const hookDef = capturedHookDefs[0];
    if (!hookDef) throw new Error("Hook not captured");
    return hookDef.run;
  }

  test("returns success for non-workflow files", () => {
    const ctx = createMockContext("/repo/src/app.ts");
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success when file cannot be read", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const ctx = createMockContext("/repo/.github/workflows/ci.yml");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success when no action refs found", () => {
    mockReadFileSync.mockReturnValue(
      "name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest",
    );

    const ctx = createMockContext("/repo/.github/workflows/ci.yml");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("calls defer when action refs are found", () => {
    mockReadFileSync.mockReturnValue(
      [
        "jobs:",
        "  build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v3",
      ].join("\n"),
    );

    const ctx = createMockContext("/repo/.github/workflows/ci.yml");
    const run = getHookRun();
    run(ctx);

    expect(ctx.defer).toHaveBeenCalled();
    expect(ctx.success).not.toHaveBeenCalled();
  });
});
