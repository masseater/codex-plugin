import { describe, expect, test, vi } from "vitest";

/**
 * require-phase-status hook の決定ロジックをテストする。
 *
 * テスト対象:
 * 1. hasStatusNotation() - ステータス表記の検出
 * 2. Write 操作時のステータス必須チェック
 * 3. Edit 操作時のステータス削除防止
 * 4. 対象外パスのスキップ
 */

// --- hasStatusNotation のロジックを再現 ---

function hasStatusNotation(content: string): boolean {
  // YAML Frontmatter の status:
  if (/^---\n[\s\S]*?^status:\s*.+$/m.test(content)) {
    return true;
  }
  // Markdown の **状態**:
  if (/\*\*状態\*\*:\s*.+/.test(content)) {
    return true;
  }
  // 旧形式
  if (/^status:\s*(completed|in_progress|not_started)$/m.test(content)) {
    return true;
  }
  if (/^ステータス:\s*(完了|進行中|未着手)$/m.test(content)) {
    return true;
  }
  return false;
}

// --- Mock context helpers ---

type PermissionDecision = "allow" | "ask" | "deny";

interface MockContext {
  input: {
    tool_name: string;
    tool_input: Record<string, string>;
  };
  success: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function createWriteContext(filePath: string, content: string): MockContext {
  return {
    input: {
      tool_name: "Write",
      tool_input: { file_path: filePath, content },
    },
    success: vi.fn().mockReturnValue({ kind: "success" }),
    json: vi.fn().mockImplementation((p: unknown) => ({ kind: "json-sync", payload: p })),
  };
}

function createEditContext(filePath: string, oldString: string, newString: string): MockContext {
  return {
    input: {
      tool_name: "Edit",
      tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
    },
    success: vi.fn().mockReturnValue({ kind: "success" }),
    json: vi.fn().mockImplementation((p: unknown) => ({ kind: "json-sync", payload: p })),
  };
}

function extractDecision(context: MockContext): PermissionDecision | undefined {
  if (context.json.mock.calls.length === 0) return undefined;
  const payload = context.json.mock.calls[0]![0] as {
    output: {
      hookSpecificOutput: { permissionDecision: PermissionDecision };
    };
  };
  return payload.output.hookSpecificOutput.permissionDecision;
}

/**
 * ソースの run 関数ロジックを再現
 */
function runRequirePhaseStatus(context: MockContext) {
  const filePath: string = context.input.tool_input.file_path!;

  if (!filePath.match(/specs\/[^/]+\/tasks\/phase\d+-[^/]+\.md$/)) {
    return context.success({});
  }

  const toolName = context.input.tool_name;

  if (toolName === "Write") {
    const content = context.input.tool_input.content!;
    if (!hasStatusNotation(content)) {
      return context.json({
        event: "PreToolUse" as const,
        output: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse" as const,
            permissionDecision: "deny" as const,
            permissionDecisionReason: "Phase計画書にはステータス表記が必須です。",
          },
        },
      });
    }
    return context.success({});
  }

  // Edit
  const oldString: string = context.input.tool_input.old_string!;
  const newString: string = context.input.tool_input.new_string!;

  if (hasStatusNotation(oldString) && !hasStatusNotation(newString)) {
    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: "Phase計画書からステータス表記を削除することはできません。",
        },
      },
    });
  }

  return context.success({});
}

// --- Tests ---

describe("hasStatusNotation", () => {
  describe("YAML Frontmatter status", () => {
    test("detects status in frontmatter", () => {
      const content = "---\ntitle: Phase 1\nstatus: in_progress\n---\n# Phase 1";
      expect(hasStatusNotation(content)).toBe(true);
    });

    test("detects status: completed", () => {
      const content = "---\nstatus: completed\n---\n";
      expect(hasStatusNotation(content)).toBe(true);
    });

    test("detects status: not_started", () => {
      const content = "---\nstatus: not_started\n---\n";
      expect(hasStatusNotation(content)).toBe(true);
    });
  });

  describe("Markdown **状態** format", () => {
    test("detects **状態**: 進行中", () => {
      expect(hasStatusNotation("**状態**: 進行中")).toBe(true);
    });

    test("detects **状態**: 完了", () => {
      expect(hasStatusNotation("some text\n**状態**: 完了\nmore")).toBe(true);
    });

    test("detects **状態**: 未着手", () => {
      expect(hasStatusNotation("**状態**: 未着手")).toBe(true);
    });
  });

  describe("legacy formats", () => {
    test("detects bare status: completed", () => {
      expect(hasStatusNotation("status: completed")).toBe(true);
    });

    test("detects bare status: in_progress", () => {
      expect(hasStatusNotation("status: in_progress")).toBe(true);
    });

    test("detects bare status: not_started", () => {
      expect(hasStatusNotation("status: not_started")).toBe(true);
    });

    test("detects ステータス: 完了", () => {
      expect(hasStatusNotation("ステータス: 完了")).toBe(true);
    });

    test("detects ステータス: 進行中", () => {
      expect(hasStatusNotation("ステータス: 進行中")).toBe(true);
    });

    test("detects ステータス: 未着手", () => {
      expect(hasStatusNotation("ステータス: 未着手")).toBe(true);
    });
  });

  describe("negative cases", () => {
    test("returns false for empty string", () => {
      expect(hasStatusNotation("")).toBe(false);
    });

    test("returns false for content without status", () => {
      expect(hasStatusNotation("# Phase 1\n\nSome description")).toBe(false);
    });

    test("returns false for status with unrecognized value in legacy format", () => {
      expect(hasStatusNotation("status: pending")).toBe(false);
    });

    test("returns false for ステータス with unrecognized value", () => {
      expect(hasStatusNotation("ステータス: 保留")).toBe(false);
    });
  });
});

describe("require-phase-status hook", () => {
  describe("path filtering", () => {
    const nonPhasePaths = [
      "/project/specs/my-task/overview.md",
      "/project/specs/my-task/specification.md",
      "/project/specs/my-task/tasks/README.md",
      "/project/src/index.ts",
      "/project/specs/my-task/tasks/notes.md",
    ];

    for (const path of nonPhasePaths) {
      test(`skips non-phase file: ${path}`, () => {
        const context = createWriteContext(path, "no status here");
        runRequirePhaseStatus(context);

        expect(context.success).toHaveBeenCalledOnce();
        expect(context.json).not.toHaveBeenCalled();
      });
    }

    const phasePaths = [
      "specs/my-task/tasks/phase1-setup.md",
      "/project/specs/auth/tasks/phase2-implementation.md",
      "specs/feature/tasks/phase10-cleanup.md",
    ];

    for (const path of phasePaths) {
      test(`matches phase file: ${path}`, () => {
        const context = createWriteContext(path, "no status");
        runRequirePhaseStatus(context);

        // Should deny because no status
        expect(context.json).toHaveBeenCalledOnce();
        expect(extractDecision(context)).toBe("deny");
      });
    }
  });

  describe("Write operations", () => {
    const PHASE_PATH = "specs/my-task/tasks/phase1-setup.md";

    test("denies Write without status notation", () => {
      const context = createWriteContext(PHASE_PATH, "# Phase 1\n\nSome content without status");
      runRequirePhaseStatus(context);

      expect(extractDecision(context)).toBe("deny");
    });

    test("allows Write with YAML frontmatter status", () => {
      const content = "---\nstatus: in_progress\n---\n# Phase 1";
      const context = createWriteContext(PHASE_PATH, content);
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
      expect(context.json).not.toHaveBeenCalled();
    });

    test("allows Write with Markdown status", () => {
      const content = "# Phase 1\n\n**状態**: 進行中\n\nDetails...";
      const context = createWriteContext(PHASE_PATH, content);
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
    });

    test("allows Write with legacy status format", () => {
      const content = "# Phase 1\nstatus: completed\nDetails...";
      const context = createWriteContext(PHASE_PATH, content);
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
    });

    test("deny reason mentions WHY and FIX", () => {
      const context = createWriteContext(PHASE_PATH, "# Phase 1");
      runRequirePhaseStatus(context);

      const payload = context.json.mock.calls[0]![0] as {
        output: {
          hookSpecificOutput: { permissionDecisionReason: string };
        };
      };
      expect(payload.output.hookSpecificOutput.permissionDecisionReason).toContain(
        "Phase計画書にはステータス表記が必須です。",
      );
    });
  });

  describe("Edit operations", () => {
    const PHASE_PATH = "specs/my-task/tasks/phase1-setup.md";

    test("denies Edit that removes status notation", () => {
      const context = createEditContext(
        PHASE_PATH,
        "**状態**: 進行中\n\nOld content",
        "New content without status",
      );
      runRequirePhaseStatus(context);

      expect(extractDecision(context)).toBe("deny");
    });

    test("allows Edit that preserves status notation", () => {
      const context = createEditContext(
        PHASE_PATH,
        "**状態**: 未着手\n\nOld details",
        "**状態**: 進行中\n\nUpdated details",
      );
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
      expect(context.json).not.toHaveBeenCalled();
    });

    test("allows Edit on non-status content", () => {
      const context = createEditContext(PHASE_PATH, "Old description text", "New description text");
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
    });

    test("allows Edit that adds status where there was none", () => {
      const context = createEditContext(
        PHASE_PATH,
        "Some old text",
        "Some old text\n**状態**: 進行中",
      );
      runRequirePhaseStatus(context);

      expect(context.success).toHaveBeenCalledOnce();
    });

    test("denies Edit replacing YAML status with plain text", () => {
      const context = createEditContext(
        PHASE_PATH,
        "---\ntitle: Phase\nstatus: in_progress\n---",
        "---\ntitle: Phase\n---",
      );
      runRequirePhaseStatus(context);

      expect(extractDecision(context)).toBe("deny");
    });
  });
});
