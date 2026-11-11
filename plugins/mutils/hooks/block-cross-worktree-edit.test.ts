import { describe, expect, test } from "vitest";
import { isAbsolute, relative } from "node:path";

/**
 * Tests for the pure logic in block-cross-worktree-edit.ts.
 * The helper functions are not exported from the hook entry, so we
 * replicate them here to verify the path-containment and worktree
 * resolution logic independently (same convention as block-unsafe-type-assertion.test.ts).
 */

const parseWorktreeList = (porcelain: string): string[] => {
  const paths: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice("worktree ".length).trim());
    }
  }
  return paths;
};

const isUnder = (filePath: string, dir: string): boolean => {
  if (filePath === dir) return true;
  const rel = relative(dir, filePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

const findContainingWorktree = (filePath: string, worktrees: string[]): string | null => {
  const sorted = [...worktrees].toSorted((a, b) => b.length - a.length);
  for (const wt of sorted) {
    if (isUnder(filePath, wt)) return wt;
  }
  return null;
};

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
