/**
 * CI（check run / workflow run）の結果の判定。on-push hook と pr-watch のスクリプトで共有する。
 */

/** 失敗として扱う conclusion。on-push hook の run / job 判定もこの集合を使う */
export const FAILURE_CONCLUSIONS: ReadonlySet<string> = new Set([
  "failure",
  "timed_out",
  "startup_failure",
  "action_required",
]);

/** 成功ではないが merge を妨げない conclusion */
const NEUTRAL_CONCLUSIONS: ReadonlySet<string> = new Set(["neutral", "skipped"]);

export type CheckState = { status: string; conclusion: string | null };

export type OverallStatus = "success" | "failure" | "pending" | "neutral";

/**
 * 完了した check が失敗に当たるかを判定する。
 * FAILURE_CONCLUSIONS に加え、cancelled・stale など成功でも neutral でもない conclusion も失敗に数える。
 * PR の head に対する check がそれらで終わっていると、再実行しない限り merge の条件を満たさないため。
 *
 * @param check - check run の status と conclusion
 * @returns 完了していて失敗に当たるなら true
 */
export function isFailedCheck(check: CheckState): boolean {
  return check.status === "completed" && isFailedConclusion(check.conclusion ?? "");
}

/**
 * conclusion が失敗に当たるかを判定する。FAILURE_CONCLUSIONS はどれも成功でも neutral でもないため、この判定に含まれる。
 *
 * @param conclusion - check run の conclusion
 * @returns 成功でも neutral でもなければ true
 */
function isFailedConclusion(conclusion: string): boolean {
  return conclusion !== "success" && !NEUTRAL_CONCLUSIONS.has(conclusion);
}

/**
 * check run の一覧から全体の状態を決める。並び順に依存しないよう全件を見て、
 * 失敗 > 未完了 > neutral > 成功 の順で優先する。失敗が分かっていれば未完了の check を待たずに直せるため。
 *
 * @param checks - check run の status と conclusion の一覧
 * @returns 全体の状態
 */
export function computeOverallStatus(checks: readonly CheckState[]): OverallStatus {
  if (checks.some(isFailedCheck)) return "failure";
  if (checks.some((check) => check.status !== "completed")) return "pending";
  if (checks.some((check) => NEUTRAL_CONCLUSIONS.has(check.conclusion ?? ""))) return "neutral";
  return "success";
}
