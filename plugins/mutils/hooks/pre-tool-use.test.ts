import { describe, expect, test } from "vite-plus/test";
import { denyToolUse } from "./lib/pre-tool-use.ts";

describe("denyToolUse", () => {
  test("builds a PreToolUse deny output carrying the reason", () => {
    expect(denyToolUse("no")).toEqual({
      event: "PreToolUse",
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "no",
        },
      },
    });
  });
});
