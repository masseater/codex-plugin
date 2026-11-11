import { describe, expect, it } from "vite-plus/test";
import { mapWithConcurrency } from "./concurrency.ts";

describe("mapWithConcurrency", () => {
  it("結果を入力と同じ順に返し、index を渡す", async () => {
    const out = await mapWithConcurrency(["a", "b", "c"], 2, async (item, i) => `${item}${i}`);
    expect(out).toEqual(["a0", "b1", "c2"]);
  });

  it("同時実行数を limit 以下に抑える", async () => {
    let inflight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inflight -= 1;
    });
    expect(peak).toBe(2);
  });

  it("空配列では task を呼ばない", async () => {
    expect(await mapWithConcurrency([], 3, async (n: number) => n)).toEqual([]);
  });

  it("undefined の要素に当たるとそこで worker を止める", async () => {
    const seen: unknown[] = [];
    await mapWithConcurrency([1, undefined, 3], 1, async (item) => seen.push(item));
    expect(seen).toEqual([1]);
  });
});
