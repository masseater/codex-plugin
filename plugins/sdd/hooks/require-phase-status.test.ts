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

import { decideRequirePhaseStatus, hasFrontmatterStatus } from "./entry/require-phase-status.ts";

/**
 * require-phase-status hook の決定ロジックをテストする。
 *
 * テスト対象:
 * 1. hasFrontmatterStatus() - 先頭 frontmatter の status の検出
 * 2. Write 操作時の status 必須チェック
 * 3. Edit 操作時の status 削除・不正値の防止
 * 4. 対象外パスのスキップ
 */

describe("hasFrontmatterStatus", () => {
  for (const status of ["not_started", "in_progress", "completed", "rejected"]) {
    test(`detects status: ${status} in frontmatter`, () => {
      expect(hasFrontmatterStatus(`---\nstatus: ${status}\n---\n# Phase 1`)).toBe(true);
    });
  }

  test("detects status among other frontmatter keys", () => {
    expect(hasFrontmatterStatus("---\ntitle: Setup\nstatus: in_progress\n---\n")).toBe(true);
  });

  test("rejects an unknown status value", () => {
    expect(hasFrontmatterStatus("---\nstatus: pending\n---\n")).toBe(false);
  });

  test("rejects status outside the frontmatter", () => {
    expect(hasFrontmatterStatus("# Phase 1\nstatus: completed\n")).toBe(false);
  });

  test("rejects legacy Markdown and Japanese notations", () => {
    expect(hasFrontmatterStatus("# Phase 1\n\n**状態**: 進行中")).toBe(false);
    expect(hasFrontmatterStatus("ステータス: 完了")).toBe(false);
  });

  test("rejects content without frontmatter", () => {
    expect(hasFrontmatterStatus("")).toBe(false);
    expect(hasFrontmatterStatus("# Phase 1\n\nSome description")).toBe(false);
  });
});

describe("decideRequirePhaseStatus", () => {
  describe("path filtering", () => {
    const nonPhasePaths = [
      "/project/specs/my-task/overview.md",
      "/project/specs/my-task/specification.md",
      "/project/specs/my-task/phases/README.md",
      "/project/specs/my-task/tasks/phase1-setup.md",
      "/project/src/index.ts",
      "/project/specs/my-task/phases/notes.md",
    ];

    for (const path of nonPhasePaths) {
      test(`skips non-phase file: ${path}`, () => {
        const result = decideRequirePhaseStatus({
          filePath: path,
          toolName: "Write",
          content: "no status here",
        });

        expect(result.decision).toBe("allow");
      });
    }

    const phasePaths = [
      "specs/my-task/phases/phase1-setup.md",
      "/project/specs/auth/phases/phase2-implementation.md",
      "specs/feature/phases/phase10-cleanup.md",
    ];

    for (const path of phasePaths) {
      test(`matches phase file: ${path}`, () => {
        const result = decideRequirePhaseStatus({
          filePath: path,
          toolName: "Write",
          content: "no status",
        });

        // Should deny because no status
        expect(result.decision).toBe("deny");
      });
    }
  });

  describe("Write operations", () => {
    const PHASE_PATH = "specs/my-task/phases/phase1-setup.md";

    test("denies Write without frontmatter status", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Write",
        content: "# Phase 1\n\nSome content without status",
      });
      expect(result.decision).toBe("deny");
    });

    test("allows Write with frontmatter status", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Write",
        content: "---\nstatus: in_progress\n---\n# Phase 1",
      });
      expect(result.decision).toBe("allow");
    });

    test("denies Write with the legacy Markdown notation", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Write",
        content: "# Phase 1\n\n**状態**: 進行中\n\nDetails...",
      });
      expect(result.decision).toBe("deny");
    });

    test("deny reason states the requirement as a fact and shows the block to add", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Write",
        content: "# Phase 1",
      });
      if (result.decision !== "deny") throw new Error("expected deny");
      expect(result.reason).toContain("phase ファイルは先頭の frontmatter に status");
      expect(result.reason).toContain("status: not_started");
      expect(result.reason).not.toContain("ください");
    });
  });

  describe("Edit operations", () => {
    const PHASE_PATH = "specs/my-task/phases/phase1-setup.md";

    test("denies Edit that removes the status line", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Edit",
        oldString: "---\ntitle: Phase\nstatus: in_progress\n---",
        newString: "---\ntitle: Phase\n---",
      });
      if (result.decision !== "deny") throw new Error("expected deny");
      expect(result.reason).toContain("frontmatter から status を消す");
    });

    test("allows Edit that changes the status value", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Edit",
        oldString: "status: not_started",
        newString: "status: in_progress",
      });
      expect(result.decision).toBe("allow");
    });

    test("denies Edit that sets an unknown status value", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Edit",
        oldString: "status: not_started",
        newString: "status: done",
      });
      expect(result.decision).toBe("deny");
    });

    test("allows Edit on non-status content", () => {
      const result = decideRequirePhaseStatus({
        filePath: PHASE_PATH,
        toolName: "Edit",
        oldString: "Old description text",
        newString: "New description text",
      });
      expect(result.decision).toBe("allow");
    });
  });
});
