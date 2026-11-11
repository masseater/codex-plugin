import { describe, expect, it } from "vitest";
import { jaccard, parseLabels, recencyScore, toFtsQuery, toIssueState } from "./search.ts";

describe("toIssueState", () => {
  it("passes through valid states", () => {
    expect(toIssueState("open")).toBe("open");
    expect(toIssueState("closed")).toBe("closed");
  });
  it("rejects unknown states", () => {
    expect(toIssueState("all")).toBeNull();
    expect(toIssueState("")).toBeNull();
    expect(toIssueState("OPEN")).toBeNull();
  });
});

describe("parseLabels", () => {
  it("returns string array for valid JSON", () => {
    expect(parseLabels('["bug","p1"]')).toEqual(["bug", "p1"]);
  });
  it("returns empty on invalid JSON", () => {
    expect(parseLabels("not json")).toEqual([]);
  });
  it("returns empty on non-array JSON", () => {
    expect(parseLabels('{"a":1}')).toEqual([]);
  });
  it("filters non-string entries", () => {
    expect(parseLabels('["bug",1,null,"p1"]')).toEqual(["bug", "p1"]);
  });
});

describe("jaccard", () => {
  it("returns 0 when both sets are empty", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("returns 0 when one set is empty", () => {
    expect(jaccard(new Set(["a"]), new Set())).toBe(0);
  });
  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("computes intersection over union", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]))).toBeCloseTo(2 / 4);
  });
});

describe("recencyScore", () => {
  const now = Date.parse("2026-04-22T00:00:00Z");
  it("returns 1 for now", () => {
    expect(recencyScore("2026-04-22T00:00:00Z", now)).toBe(1);
  });
  it("returns ~0.5 at one year", () => {
    const oneYearAgo = new Date(now - 365 * 86_400_000).toISOString();
    expect(recencyScore(oneYearAgo, now)).toBeCloseTo(0.5, 2);
  });
  it("returns 0 for invalid input", () => {
    expect(recencyScore("not-a-date", now)).toBe(0);
  });
  it("clamps future updatedAt to 1", () => {
    const future = new Date(now + 86_400_000).toISOString();
    expect(recencyScore(future, now)).toBe(1);
  });
});

describe("toFtsQuery", () => {
  it("returns empty for sub-3-char input", () => {
    expect(toFtsQuery("a")).toBe("");
    expect(toFtsQuery("ab")).toBe("");
    expect(toFtsQuery("  x  ")).toBe("");
  });
  it("strips FTS5 operator characters", () => {
    expect(toFtsQuery('foo"bar(baz)*:')).toBe('"foo" OR "bar" OR "baz"');
  });
  it("joins ≥3 char words with OR", () => {
    expect(toFtsQuery("type script error")).toBe('"type" OR "script" OR "error"');
  });
  it("drops <3 char words", () => {
    expect(toFtsQuery("a bb ccc ddddd")).toBe('"ccc" OR "ddddd"');
  });
  it("wraps single non-whitespaced short block", () => {
    expect(toFtsQuery("エラー")).toBe('"エラー"');
  });
  it("normalizes NFKC", () => {
    const result = toFtsQuery("ＴＹＰＥＳｃｒｉｐｔ");
    expect(result).toBe('"TYPEScript"');
  });
});
