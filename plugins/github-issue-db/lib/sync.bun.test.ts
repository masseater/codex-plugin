import { describe, expect, it } from "bun:test";
import { mapWithConcurrency, normalizeLabels, shouldForceFull, sinceWithSkew } from "./sync.ts";

describe("sinceWithSkew", () => {
  it("subtracts 60s by default", () => {
    expect(sinceWithSkew("2026-04-22T00:01:00Z")).toBe("2026-04-22T00:00:00.000Z");
  });
  it("honors explicit skew", () => {
    expect(sinceWithSkew("2026-04-22T00:01:00Z", 0)).toBe("2026-04-22T00:01:00.000Z");
  });
});

describe("shouldForceFull", () => {
  it("forces when opts.force is true", () => {
    expect(shouldForceFull(100, 100, true, "2026-04-22")).toBe(true);
  });
  it("forces when lastSync is undefined", () => {
    expect(shouldForceFull(100, 100, false, undefined)).toBe(true);
  });
  it("does not force when lastTotal is 0 but lastSync exists", () => {
    expect(shouldForceFull(100, 0, false, "2026-04-22")).toBe(false);
  });
  it("does not force on small delta (<5%)", () => {
    expect(shouldForceFull(103, 100, false, "2026-04-22")).toBe(false);
  });
  it("forces on large delta (>5%)", () => {
    expect(shouldForceFull(110, 100, false, "2026-04-22")).toBe(true);
  });
  it("forces on delta from total drop (issues deleted/transferred)", () => {
    expect(shouldForceFull(80, 100, false, "2026-04-22")).toBe(true);
  });
});

describe("normalizeLabels", () => {
  it("collects string labels", () => {
    expect(normalizeLabels(["bug", "p1"])).toEqual(["bug", "p1"]);
  });
  it("collects object labels with name", () => {
    expect(normalizeLabels([{ name: "bug" }, { name: "p1" }])).toEqual(["bug", "p1"]);
  });
  it("ignores nulls and objects without name", () => {
    expect(normalizeLabels([null, undefined, { name: null }, "bug"])).toEqual(["bug"]);
  });
  it("handles mixed input", () => {
    expect(normalizeLabels([{ name: "bug" }, "p1", null, "help wanted"])).toEqual([
      "bug",
      "p1",
      "help wanted",
    ]);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("respects concurrency cap (never exceeds limit in flight)", async () => {
    let inflight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 5, async (n) => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 1));
      inflight -= 1;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(5);
  });

  it("handles empty input", async () => {
    expect(await mapWithConcurrency([], 3, async (n: number) => n)).toEqual([]);
  });
});
