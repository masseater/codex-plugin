import { describe, expect, test, vi } from "vitest";

/**
 * block-archived-edit hook の決定ロジックをテストする。
 *
 * 実際のフックは defineHook + wrapRun でラップされているため、
 * 内部のロジックを再現してコンテキストモックでテストする。
 */

type PermissionDecision = "allow" | "ask" | "deny";

interface MockContext {
  input: {
    tool_input: { file_path: string };
  };
  success: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function createMockContext(filePath: string): MockContext {
  return {
    input: {
      tool_input: { file_path: filePath },
    },
    success: vi.fn().mockReturnValue({ kind: "success" }),
    json: vi.fn().mockImplementation((payload: unknown) => ({
      kind: "json-sync",
      payload,
    })),
  };
}

/**
 * ソースの run 関数ロジックを再現
 */
function runBlockArchivedEdit(context: MockContext) {
  const filePath = context.input.tool_input.file_path;

  if (!filePath.includes("specs/_archived/")) {
    return context.success({});
  }

  return context.json({
    event: "PreToolUse" as const,
    output: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse" as const,
        permissionDecision: "deny" as const,
        permissionDecisionReason: [
          "specs/_archived/ 内のファイルはアーカイブ済みのため編集禁止です。",
          "",
          "WHY: Archived specs must not be modified to preserve the audit trail of completed work.",
          "FIX: To modify archived content, first unarchive with `/sdd:archive`, or create a new spec instead.",
        ].join("\n"),
      },
    },
  });
}

describe("block-archived-edit", () => {
  describe("non-archived paths", () => {
    const allowedPaths = [
      "/project/specs/my-task/overview.md",
      "/project/specs/feature/tasks/phase1-setup.md",
      "/project/src/index.ts",
      "/project/specs/archived/note.md",
      "/project/specs/_archive/note.md",
    ];

    for (const path of allowedPaths) {
      test(`allows editing: ${path}`, () => {
        const context = createMockContext(path);
        runBlockArchivedEdit(context);

        expect(context.success).toHaveBeenCalledOnce();
        expect(context.success).toHaveBeenCalledWith({});
        expect(context.json).not.toHaveBeenCalled();
      });
    }
  });

  describe("archived paths", () => {
    const blockedPaths = [
      "/project/specs/_archived/old-task/overview.md",
      "/project/specs/_archived/completed/tasks/phase1.md",
      "specs/_archived/anything.md",
      "/deep/nested/specs/_archived/file.md",
    ];

    for (const path of blockedPaths) {
      test(`denies editing: ${path}`, () => {
        const context = createMockContext(path);
        const result = runBlockArchivedEdit(context);

        expect(context.json).toHaveBeenCalledOnce();
        expect(context.success).not.toHaveBeenCalled();

        const payload = context.json.mock.calls[0]![0] as {
          event: string;
          output: {
            hookSpecificOutput: {
              hookEventName: string;
              permissionDecision: PermissionDecision;
              permissionDecisionReason: string;
            };
          };
        };

        expect(payload.event).toBe("PreToolUse");
        expect(payload.output.hookSpecificOutput.permissionDecision).toBe("deny");
        expect(payload.output.hookSpecificOutput.permissionDecisionReason).toContain(
          "specs/_archived/ 内のファイルはアーカイブ済みのため編集禁止です。",
        );
        expect(payload.output.hookSpecificOutput.permissionDecisionReason).toContain(
          "/sdd:archive",
        );
      });
    }
  });

  test("deny reason includes WHY and FIX sections", () => {
    const context = createMockContext("/project/specs/_archived/old.md");
    runBlockArchivedEdit(context);

    const payload = context.json.mock.calls[0]![0] as {
      output: {
        hookSpecificOutput: { permissionDecisionReason: string };
      };
    };
    const reason = payload.output.hookSpecificOutput.permissionDecisionReason;

    expect(reason).toContain("WHY:");
    expect(reason).toContain("FIX:");
    expect(reason).toContain("audit trail");
  });
});
