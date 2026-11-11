/**
 * issue の同期方法（差分か全件か）と、同期する値の整形を決める純粋関数群。
 */

const FORCE_FULL_DIFF_RATIO = 0.05;

export function sinceWithSkew(iso: string, skewMs = 60_000): string {
  const ms = new Date(iso).getTime();
  return new Date(ms - skewMs).toISOString();
}

export function shouldForceFull(
  currentTotal: number,
  lastTotal: number,
  forced: boolean,
  lastSync: string | undefined,
): boolean {
  if (forced || !lastSync) return true;
  if (lastTotal <= 0) return false;
  return Math.abs(currentTotal - lastTotal) / Math.max(lastTotal, 1) > FORCE_FULL_DIFF_RATIO;
}

export type LabelLike = { name?: string | null } | string | null | undefined;

/**
 * GitHub の label（文字列か name を持つオブジェクト）から名前を取り出す。
 *
 * @param label - GitHub の label
 * @returns 名前を 1 つ含む配列。名前が無ければ空
 */
function labelNames(label: LabelLike): string[] {
  if (!label) return [];
  if (typeof label === "string") return [label];
  return typeof label.name === "string" ? [label.name] : [];
}

export function normalizeLabels(labels: readonly LabelLike[]): string[] {
  return labels.flatMap(labelNames);
}
