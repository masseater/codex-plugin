import { describe, expect, test } from "vite-plus/test";
import { parseLabelList, resolveCommentBody, resolveStateChange } from "./update-issue-status.ts";

describe("parseLabelList", () => {
  test("returns an empty array for undefined", () => {
    expect(parseLabelList(undefined)).toEqual([]);
  });

  test("splits, trims, and drops empty entries", () => {
    expect(parseLabelList(" bug , , enhancement ,")).toEqual(["bug", "enhancement"]);
  });

  test("handles a single label", () => {
    expect(parseLabelList("done")).toEqual(["done"]);
  });
});

describe("resolveStateChange", () => {
  test("returns null when neither close nor reopen is set", () => {
    expect(resolveStateChange({})).toBeNull();
  });

  test("closes with the completed reason by default", () => {
    expect(resolveStateChange({ close: true })).toEqual({
      state: "closed",
      stateReason: "completed",
    });
  });

  test("closes with not_planned when requested", () => {
    expect(resolveStateChange({ close: true, stateReason: "not_planned" })).toEqual({
      state: "closed",
      stateReason: "not_planned",
    });
  });

  test("reopens without a state reason", () => {
    expect(resolveStateChange({ reopen: true })).toEqual({
      state: "open",
      stateReason: null,
    });
  });

  test("throws when close and reopen are both set", () => {
    expect(() => resolveStateChange({ close: true, reopen: true })).toThrow(
      "Cannot use --close and --reopen together",
    );
  });

  test("throws on an invalid state reason", () => {
    expect(() => resolveStateChange({ close: true, stateReason: "wontfix" })).toThrow(
      'Invalid --state-reason: "wontfix"',
    );
  });
});

describe("resolveCommentBody", () => {
  test("returns the inline comment", () => {
    expect(resolveCommentBody({ comment: "done" })).toBe("done");
  });

  test("reads the comment file", () => {
    expect(resolveCommentBody({ commentFile: "/tmp/c.md" }, () => "from file")).toBe("from file");
  });

  test("returns undefined when no comment is requested", () => {
    expect(resolveCommentBody({})).toBeUndefined();
  });

  test("rejects both flags together", () => {
    expect(() => resolveCommentBody({ comment: "a", commentFile: "b" })).toThrow("together");
  });
});
