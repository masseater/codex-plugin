import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

// MutilsDB は bun:sqlite に依存するため vitest では開けない。open をモックし、テーブルの偽物を返す
// defineHook のモックが受け取った run を captured に保存し、hook.run を直接呼べるようにする
const { openMutilsDb, logger, findAll, captured } = vi.hoisted(() => ({
  openMutilsDb: vi.fn(),
  findAll: vi.fn(),
  captured: {} as { run?: (ctx: unknown) => unknown },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  },
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: { fromFile: () => logger },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
  findGitRoot: vi.fn(),
  MutilsDB: { open: openMutilsDb },
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => {
    captured.run = opts.run;
    return opts;
  }),
  runHook: vi.fn(),
}));
vi.mock("./lib/workspace-mappings-schema.ts", () => ({
  hasAgentsDir: vi.fn(),
  openWorkspaceMappings: vi.fn(() => ({ findAll })),
}));

import { findGitRoot } from "@r_masseater/cc-plugin-lib";
import { formatRestoredContext, getLatestWorkspaceMapping } from "./entry/workspace-id-persist.ts";
import { hasAgentsDir } from "./lib/workspace-mappings-schema.ts";

const dispose = vi.fn();

function mapping(workspaceId: string) {
  return {
    workspace_id: workspaceId,
    feature_name: "f",
    created_at: "2026-07-01T00:00:00Z",
    session_id: "s1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findAll.mockReset();
  openMutilsDb.mockReturnValue({ [Symbol.dispose]: dispose });
});

describe("getLatestWorkspaceMapping", () => {
  test("queries the latest row of the session and closes the DB", () => {
    findAll.mockReturnValue([mapping("ws-2")]);

    expect(getLatestWorkspaceMapping("/repo", "s1")?.workspace_id).toBe("ws-2");
    expect(openMutilsDb).toHaveBeenCalledWith("/repo");
    expect(findAll).toHaveBeenCalledWith("session_id = ? ORDER BY id DESC LIMIT 1", ["s1"]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test("returns null when no row matches", () => {
    findAll.mockReturnValue([]);
    expect(getLatestWorkspaceMapping("/repo", "s1")).toBeNull();
  });

  test("logs and returns null when the DB cannot be opened", () => {
    const error = new Error("boom");
    openMutilsDb.mockImplementation(() => {
      throw error;
    });

    expect(getLatestWorkspaceMapping("/repo", "s1")).toBeNull();
    expect(logger.error).toHaveBeenCalledWith("Failed to get workspace mapping", { err: error });
  });
});

describe("formatRestoredContext", () => {
  test("states the id, the source and the directory", () => {
    const text = formatRestoredContext("20260701-1200-x", "compact");
    expect(text).toContain("20260701-1200-x");
    expect(text).toContain("compact");
    expect(text).toContain(".agents/workspaces/20260701-1200-x/");
  });
});

describe("hook.run", () => {
  const success = vi.fn((value: unknown) => ({ kind: "success", value }));
  const json = vi.fn((value: unknown) => ({ kind: "json", value }));

  function run(input: object) {
    if (!captured.run) throw new Error("defineHook was not called");
    return captured.run({ input, success, json });
  }

  beforeEach(() => {
    vi.mocked(findGitRoot).mockReturnValue("/repo");
    vi.mocked(hasAgentsDir).mockReturnValue(true);
  });

  test("skips outside a git repository", () => {
    vi.mocked(findGitRoot).mockReturnValue(null);

    expect(run({ session_id: "s1", source: "resume" })).toEqual({ kind: "success", value: {} });
    expect(openMutilsDb).not.toHaveBeenCalled();
  });

  test("skips when .agents does not exist", () => {
    vi.mocked(hasAgentsDir).mockReturnValue(false);

    expect(run({ session_id: "s1", source: "resume" })).toEqual({ kind: "success", value: {} });
    expect(openMutilsDb).not.toHaveBeenCalled();
  });

  test.each([
    { session_id: "s1", source: "startup" },
    { session_id: "s1" },
    { session_id: "s1", source: 1 },
  ])("skips a session that is not compact/resume: %j", (input) => {
    expect(run(input)).toEqual({ kind: "success", value: {} });
    expect(openMutilsDb).not.toHaveBeenCalled();
  });

  test("skips when the session has no mapping", () => {
    findAll.mockReturnValue([]);

    expect(run({ session_id: "s1", source: "compact" })).toEqual({ kind: "success", value: {} });
  });

  test.each(["compact", "resume"])("restores the workspace-id on %s", (source) => {
    findAll.mockReturnValue([mapping("ws-9")]);

    expect(run({ session_id: "s1", source })).toEqual({
      kind: "json",
      value: {
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: formatRestoredContext("ws-9", source),
          },
        },
      },
    });
    expect(findAll).toHaveBeenCalledWith(expect.any(String), ["s1"]);
  });
});
