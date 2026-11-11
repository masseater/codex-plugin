import { describe, expect, it } from "vite-plus/test";
import { normalizeLabels, shouldForceFull, sinceWithSkew } from "./sync-rules.ts";

describe("sinceWithSkew", () => {
  it("既定で 60 秒遡り、skew を指定できる", () => {
    expect(sinceWithSkew("2026-04-22T00:01:00Z")).toBe("2026-04-22T00:00:00.000Z");
    expect(sinceWithSkew("2026-04-22T00:01:00Z", 0)).toBe("2026-04-22T00:01:00.000Z");
  });
});

describe("shouldForceFull", () => {
  it.each([
    ["force 指定", 100, 100, true, "2026-04-22", true],
    ["前回同期なし", 100, 100, false, undefined, true],
    ["前回の総数が 0", 100, 0, false, "2026-04-22", false],
    ["差が 5% 以下", 103, 100, false, "2026-04-22", false],
    ["増加が 5% 超", 110, 100, false, "2026-04-22", true],
    ["減少が 5% 超", 80, 100, false, "2026-04-22", true],
  ])("%s", (_name, current, last, forced, lastSync, expected) => {
    expect(shouldForceFull(current, last, forced, lastSync)).toBe(expected);
  });
});

describe("normalizeLabels", () => {
  it("文字列とオブジェクトの label から名前だけを集める", () => {
    expect(normalizeLabels([{ name: "bug" }, "p1", null, undefined, { name: null }, {}])).toEqual([
      "bug",
      "p1",
    ]);
  });
});
