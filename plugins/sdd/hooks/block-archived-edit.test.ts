import { describe, expect, test, vi } from "vite-plus/test";

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

import { decideBlockArchivedEdit } from "./entry/block-archived-edit.ts";

describe("block-archived-edit", () => {
  describe("non-archived paths", () => {
    const allowedPaths = [
      "/project/specs/my-task/overview.md",
      "/project/specs/feature/phases/phase1-setup.md",
      "/project/src/index.ts",
      "/project/specs/archived/note.md",
      "/project/specs/_archive/note.md",
    ];

    for (const path of allowedPaths) {
      test(`allows editing: ${path}`, () => {
        const result = decideBlockArchivedEdit(path);

        expect(result.decision).toBe("allow");
      });
    }
  });

  describe("archived paths", () => {
    const blockedPaths = [
      "/project/specs/_archived/old-task/overview.md",
      "/project/specs/_archived/completed/phases/phase1-setup.md",
      "specs/_archived/anything.md",
      "/deep/nested/specs/_archived/file.md",
    ];

    for (const path of blockedPaths) {
      test(`denies editing: ${path}`, () => {
        const result = decideBlockArchivedEdit(path);

        expect(result.decision).toBe("deny");
        if (result.decision !== "deny") throw new Error("unreachable");

        expect(result.reason).toContain("specs/_archived/ はアーカイブ済みの spec");
      });
    }
  });

  test("deny reason gives the reason and points to a new spec instead of a missing unarchive", () => {
    const result = decideBlockArchivedEdit("/project/specs/_archived/old.md");

    expect(result.decision).toBe("deny");
    if (result.decision !== "deny") throw new Error("unreachable");

    expect(result.reason).toContain("完了した作業の記録を保つため");
    expect(result.reason).toContain("/sdd:spec init");
    expect(result.reason).not.toContain("unarchive");
  });
});
