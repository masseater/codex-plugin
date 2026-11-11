/**
 * 各要素に非同期処理を適用する。同時に走らせる処理の数を limit 以下に抑え、結果は入力と同じ順に並べる。
 *
 * @param items - 処理する要素
 * @param limit - 同時に走らせる処理の上限
 * @param task - 要素ごとの非同期処理
 * @returns 各要素の処理結果（入力と同じ順）
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      results[i] = await task(item, i);
    }
  });
  await Promise.all(workers);
  return results;
}
