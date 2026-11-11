import { describe, expect, test } from "vitest";

/**
 * Test the decision logic from redirect-figma-screenshot.ts.
 * The hook always returns a block decision with a redirect message.
 * Since the hook has no conditional logic, we verify the output shape.
 */

describe("redirect-figma-screenshot hook output", () => {
  const expectedOutput = {
    decision: "block" as const,
    reason:
      "Use the ui-dev:figma-screenshot skill instead of get_screenshot. " +
      "Run: export-screenshot.ts --file-key <key> --node-id <id> --output <path>",
  };

  test("decision is 'block'", () => {
    expect(expectedOutput.decision).toBe("block");
  });

  test("reason mentions the alternative skill", () => {
    expect(expectedOutput.reason).toContain("ui-dev:figma-screenshot");
  });

  test("reason includes the CLI command hint", () => {
    expect(expectedOutput.reason).toContain("export-screenshot.ts");
    expect(expectedOutput.reason).toContain("--file-key");
    expect(expectedOutput.reason).toContain("--node-id");
    expect(expectedOutput.reason).toContain("--output");
  });

  test("output shape matches PreToolUse block response", () => {
    const hookResponse = {
      event: "PreToolUse" as const,
      output: expectedOutput,
    };
    expect(hookResponse.event).toBe("PreToolUse");
    expect(hookResponse.output.decision).toBe("block");
    expect(typeof hookResponse.output.reason).toBe("string");
  });
});
