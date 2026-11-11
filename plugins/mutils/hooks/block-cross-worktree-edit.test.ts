import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";

/**
 * Tests for the pure logic in block-cross-worktree-edit.ts.
 * The helper functions are exported from the hook entry and imported
 * directly here (same convention as check-context-version.test.ts).
 */

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
const captured = vi.hoisted(() => ({ hook: undefined as CapturedHook | undefined }));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: CapturedHook) => {
    captured.hook = opts;
    return opts;
  }),
  runHook: vi.fn(),
}));
const execFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync }));

import {
  findContainingWorktree,
  isUnder,
  parseWorktreeList,
  formatDenyReason,
} from "./entry/block-cross-worktree-edit.ts";

describe("parseWorktreeList", () => {
  test("extracts paths from porcelain output", () => {
    const input = [
      "worktree /repo/main",
      "HEAD abc123",
      "branch refs/heads/master",
      "",
      "worktree /repo=feature",
      "HEAD def456",
      "branch refs/heads/feature",
      "",
    ].join("\n");
    expect(parseWorktreeList(input)).toEqual(["/repo/main", "/repo=feature"]);
  });

  test("returns empty array on empty input", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });

  test("ignores detached worktrees gracefully", () => {
    const input = "worktree /repo/detached\nHEAD abc\ndetached\n";
    expect(parseWorktreeList(input)).toEqual(["/repo/detached"]);
  });
});

describe("isUnder", () => {
  test("returns true for file directly inside dir", () => {
    expect(isUnder("/repo/main/src/foo.ts", "/repo/main")).toBe(true);
  });

  test("returns true when paths are identical", () => {
    expect(isUnder("/repo/main", "/repo/main")).toBe(true);
  });

  test("returns false when file is in sibling worktree with shared prefix", () => {
    expect(isUnder("/repo/main=feature/src/foo.ts", "/repo/main")).toBe(false);
  });

  test("returns false when file is outside the dir entirely", () => {
    expect(isUnder("/tmp/foo.ts", "/repo/main")).toBe(false);
  });
});

describe("findContainingWorktree", () => {
  const worktrees = ["/repo/main", "/repo/main=feature-a", "/repo/main=feature-b"];

  test("returns the worktree that contains the file", () => {
    expect(findContainingWorktree("/repo/main=feature-a/README.md", worktrees)).toBe(
      "/repo/main=feature-a",
    );
  });

  test("prefers the longest matching worktree (no shorter-prefix false positive)", () => {
    expect(findContainingWorktree("/repo/main=feature-b/x.ts", worktrees)).toBe(
      "/repo/main=feature-b",
    );
  });

  test("returns the main worktree for files inside it", () => {
    expect(findContainingWorktree("/repo/main/src/foo.ts", worktrees)).toBe("/repo/main");
  });

  test("returns null when file is in no worktree", () => {
    expect(findContainingWorktree("/tmp/foo.ts", worktrees)).toBeNull();
  });

  test("returns null when worktree list is empty", () => {
    expect(findContainingWorktree("/repo/main/src/foo.ts", [])).toBeNull();
  });
});

describe("cross-worktree decision logic", () => {
  const worktrees = ["/repo/main", "/repo/main=feature-a", "/repo/main=feature-b"];

  const decide = (cwd: string, filePath: string): "allow" | "deny" => {
    const target = findContainingWorktree(filePath, worktrees);
    if (target === null) return "allow";
    if (isUnder(cwd, target) || cwd === target) return "allow";
    return "deny";
  };

  test("allows edit when cwd and file are in the same worktree", () => {
    expect(decide("/repo/main=feature-a", "/repo/main=feature-a/src/x.ts")).toBe("allow");
  });

  test("allows edit when cwd is a subdirectory of the target worktree", () => {
    expect(decide("/repo/main=feature-a/src", "/repo/main=feature-a/src/x.ts")).toBe("allow");
  });

  test("denies edit when cwd is main and file is in another worktree", () => {
    expect(decide("/repo/main", "/repo/main=feature-a/src/x.ts")).toBe("deny");
  });

  test("denies edit when cwd is one worktree and file is in another", () => {
    expect(decide("/repo/main=feature-a", "/repo/main=feature-b/src/x.ts")).toBe("deny");
  });

  test("denies edit when cwd is another worktree and file is in main", () => {
    expect(decide("/repo/main=feature-a", "/repo/main/src/x.ts")).toBe("deny");
  });

  test("allows edit when file is outside all known worktrees", () => {
    expect(decide("/repo/main", "/tmp/scratch.ts")).toBe("allow");
  });
});

describe("formatDenyReason", () => {
  test("names the file, worktree and the EnterWorktree alternative", () => {
    const text = formatDenyReason("/wt/b/file.ts", "/wt/b", "/wt/a");
    expect(text).toContain("/wt/b/file.ts");
    expect(text).toContain("worktree: /wt/b");
    expect(text).toContain("EnterWorktree");
  });
});

describe("hook run", () => {
  const PORCELAIN = "worktree /repo/main\nHEAD a\n\nworktree /repo/feature\nHEAD b\n";

  beforeEach(() => {
    execFileSync.mockReset();
    execFileSync.mockReturnValue(PORCELAIN);
  });

  const run = (input: unknown) => captured.hook?.run(hookContext(input));
  const success = { kind: "success", output: {} };

  test("passes when there is no file_path", () => {
    expect(run({ cwd: "/repo/main", tool_input: {} })).toEqual(success);
  });

  test("passes when the file is in the session's own worktree", () => {
    expect(run({ cwd: "/repo/main", tool_input: { file_path: "/repo/main/a.ts" } })).toEqual(
      success,
    );
  });

  test("resolves a relative path against cwd", () => {
    expect(run({ cwd: "/repo/main", tool_input: { file_path: "src/a.ts" } })).toEqual(success);
  });

  test("passes when the file is in no known worktree", () => {
    expect(run({ cwd: "/repo/main", tool_input: { file_path: "/elsewhere/a.ts" } })).toEqual(
      success,
    );
  });

  test("denies a file in another worktree", () => {
    expect(run({ cwd: "/repo/main", tool_input: { file_path: "/repo/feature/a.ts" } })).toEqual({
      kind: "json",
      output: {
        event: "PreToolUse",
        output: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: formatDenyReason(
              "/repo/feature/a.ts",
              "/repo/feature",
              "/repo/main",
            ),
          },
        },
      },
    });
  });

  test("passes when git fails (not a repository)", () => {
    execFileSync.mockImplementation(() => {
      throw new Error("not a git repository");
    });
    expect(run({ cwd: "/repo/main", tool_input: { file_path: "/repo/feature/a.ts" } })).toEqual(
      success,
    );
  });
});
