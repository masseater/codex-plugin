/**
 * issue 検索のスコア計算と FTS クエリ組み立ての純粋関数群。
 */

/**
 * GitHub の state を issue DB の状態に直す
 *
 * @param raw - GitHub が返す state
 * @returns open か closed。それ以外は null
 */
export function toIssueState(raw: string): "open" | "closed" | null {
  return raw === "open" || raw === "closed" ? raw : null;
}

export function parseLabels(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch (error) {
    // 壊れた labels_json はラベル無しとして扱う。ラベル一致はスコアの一要素にすぎず、検索自体は続けられる
    console.debug("labels_json を読めないためラベル無しとして扱う", error);
    return [];
  }
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = [...a].filter((v) => b.has(v)).length;
  return inter / (a.size + b.size - inter);
}

export function recencyScore(updatedAt: string, now: number): number {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (now - t) / 86_400_000);
  // Smooth decay: 1.0 today, ~0.5 at 1 year, asymptotes toward 0
  return 1 / (1 + days / 365);
}

/**
 * Build an FTS5 MATCH query from a raw user string. Returns empty string when
 * the sanitized text has no useful tokens for trigram indexing.
 *
 * Strategy:
 * - Strip FTS5 operators that would otherwise be interpreted (`" ( ) * :`)
 * - If the sanitized text has whitespace-separated words of ≥3 chars,
 *   emit them as an OR of quoted phrases (each phrase is trigram-matched)
 * - If no such words exist (e.g. a single short non-whitespaced block like a
 *   Japanese phrase), fall back to treating the whole sanitized text as one
 *   phrase — trigram still gives recall on 3+ Unicode code points
 * - If the full sanitized text is also under 3 chars, return empty — FTS5
 *   trigram cannot index it
 *
 * @param raw - 利用者が入力した検索語
 * @returns FTS5 の MATCH に渡すクエリ。索引できない入力なら空文字
 */
export function toFtsQuery(raw: string): string {
  const sanitized = raw
    .normalize("NFKC")
    .replace(/["()*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length < 3) return "";

  const phrases = sanitized
    .split(" ")
    .filter((t) => t.length >= 3)
    .map((t) => `"${t}"`);
  if (phrases.length > 0) return phrases.join(" OR ");

  // No ≥3-char words after splitting on whitespace. The whole block itself
  // is ≥3 chars (guard above), so wrap it as a single phrase.
  return `"${sanitized}"`;
}
