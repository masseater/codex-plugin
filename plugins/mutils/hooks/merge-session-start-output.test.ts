import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({ debug: vi.fn(), [Symbol.dispose]: vi.fn() }),
  },
}));

import { mergeOutputs, parseOutput } from "./lib/merge-session-start-output.ts";

describe("mergeOutputs", () => {
  test("joins top-level systemMessage of both outputs", () => {
    const merged = mergeOutputs({ systemMessage: "a" }, { systemMessage: "b" });
    expect(merged).toEqual({ systemMessage: "a\nb" });
  });

  test("joins additionalContext under hookSpecificOutput", () => {
    const merged = mergeOutputs(
      { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "x" } },
      { systemMessage: "m", hookSpecificOutput: { additionalContext: "y" } },
    );
    expect(merged).toEqual({
      systemMessage: "m",
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "x\n\ny" },
    });
  });

  test("returns the other output when one is missing", () => {
    expect(mergeOutputs(undefined, { systemMessage: "b" })).toEqual({ systemMessage: "b" });
    expect(mergeOutputs(undefined, undefined)).toBeUndefined();
  });
});

describe("parseOutput", () => {
  test("returns undefined for non-JSON text", () => {
    expect(parseOutput("bun install v1")).toBeUndefined();
  });

  test("returns undefined for JSON that is not a SessionStart output", () => {
    expect(parseOutput("[1]")).toBeUndefined();
    expect(parseOutput('{"systemMessage":1}')).toBeUndefined();
    expect(parseOutput('{"hookSpecificOutput":"x"}')).toBeUndefined();
    expect(parseOutput('{"hookSpecificOutput":{"additionalContext":1}}')).toBeUndefined();
  });

  test("returns a valid SessionStart output as is", () => {
    const text = '{"systemMessage":"m","hookSpecificOutput":{"additionalContext":"c"},"x":1}';
    expect(parseOutput(text)).toEqual(JSON.parse(text));
  });
});

describe("mergeOutputs keeping the first output", () => {
  test("returns the first output when the second is missing", () => {
    expect(mergeOutputs({ systemMessage: "a" }, undefined)).toEqual({ systemMessage: "a" });
  });

  test("keeps other keys, preferring the second output's value", () => {
    expect(mergeOutputs({ k: 1, keep: true }, { k: 2 })).toEqual({ k: 2, keep: true });
  });
});
